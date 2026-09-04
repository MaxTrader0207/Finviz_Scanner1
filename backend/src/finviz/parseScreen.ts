import * as cheerio from "cheerio";
import { z } from "zod";

/**
 * Finviz 沒有公開文件化的 API，這裡解析的是 screener Overview 頁面的表格 HTML。
 * Finviz 改版時這個檔案的選擇器可能需要更新 —— 這是刻意把「解析邏輯」獨立成
 * 純函式（不含網路請求）的原因：可以用固定的 HTML fixture 寫回歸測試，
 * 一旦 Finviz 改版導致解析失敗，測試會第一時間變紅，而不是安靜地在生產環境
 * 回傳空陣列。
 *
 * 使用前建議：實際部署前，先用瀏覽器 DevTools 對照目前 Finviz 頁面的表格
 * class/id，確認下方的選擇器仍然成立，並把當時的頁面存成
 * server/finviz/__fixtures__/finviz-screener-sample.html 讓測試持續有效。
 */

export const scrapedStockSchema = z.object({
  ticker: z.string().regex(/^[A-Z.]{1,10}$/),
  company: z.string().min(1),
  sector: z.string().min(1),
  industry: z.string().min(1),
  country: z.string().min(1),
  marketCapLabel: z.string().min(1),
  marketCapBn: z.number().finite().nonnegative(),
  pe: z.string().min(1),
  price: z.number().finite().nonnegative(),
  change: z.number().finite(),
  volume: z.number().int().nonnegative(),
  /** 只有用 Valuation 檢視（v=121）抓取的視角才會有這個欄位，例如 defensiveIncomeValue。 */
  priceToBook: z.string().min(1).optional(),
});

export type ScrapedStock = z.infer<typeof scrapedStockSchema>;

export type ParseResult = {
  stocks: ScrapedStock[];
  /** 有解析到列但欄位不符合 schema 而被跳過的數量，用來判斷選擇器是否可能過時。 */
  skippedRowCount: number;
};

/**
 * "5.10B" / "483.94M" / "19.94M" / "—" -> 以「十億美元」為單位的數字。
 * 對應 screenerData.ts 既有的 marketCapBn 欄位定義。
 */
export function parseMarketCapToBillions(label: string): number {
  const trimmed = label.trim();
  const match = trimmed.match(/^([\d.]+)\s*([BMK])$/i);
  if (!match) return 0;
  const [, numText, unit] = match;
  const num = Number(numText);
  if (!Number.isFinite(num) || !unit) return 0;
  switch (unit.toUpperCase()) {
    case "B":
      return num;
    case "M":
      return num / 1000;
    case "K":
      return num / 1_000_000;
    default:
      return 0;
  }
}

function parseNumberCell(text: string): number {
  return Number(text.replace(/[%,$]/g, "").trim());
}

/**
 * Finviz screener Overview 表格欄位順序（v=111 檢視）固定為：
 * No. / Ticker / Company / Sector / Industry / Country / Market Cap / P/E / Price / Change / Volume
 */
const OVERVIEW_COLUMN_INDEX = {
  ticker: 1,
  company: 2,
  sector: 3,
  industry: 4,
  country: 5,
  marketCap: 6,
  pe: 7,
  price: 8,
  change: 9,
  volume: 10,
} as const;

/**
 * Finviz screener Valuation 表格欄位順序（v=121 檢視）。跟 Overview 不同，
 * 這個檢視在 P/E 後面多了 Fwd P/E / PEG / P/S / P/B / P/C / P/FCF / EPS past 5Y /
 * EPS next 5Y / Sales past 5Y 這些欄位，Price 的位置也因此往後移。
 *
 * 這組索引是依照一份真實抓到的 Finviz Valuation 檢視範例頁面推算出來的，
 * 不是 100% 對照過即時頁面確認—— defensiveIncomeValue 這個視角改用這個
 * layout 之後，請務必用 pnpm dlx wrangler d1 execute 查一次真實同步結果，
 * 確認 P/B 數值合理（例如不是市值或成交量之類跑錯欄位的數字）。
 */
const VALUATION_COLUMN_INDEX = {
  ticker: 1,
  company: 2,
  sector: 3,
  industry: 4,
  country: 5,
  marketCap: 6,
  pe: 7,
  priceToBook: 11,
  price: 17,
  change: 18,
  volume: 19,
} as const;

export type ScreenerColumnLayout = {
  ticker: number;
  company: number;
  sector: number;
  industry: number;
  country: number;
  marketCap: number;
  pe: number;
  price: number;
  change: number;
  volume: number;
  priceToBook?: number;
};

export const SCREENER_LAYOUTS = {
  overview: OVERVIEW_COLUMN_INDEX,
  valuation: VALUATION_COLUMN_INDEX,
} satisfies Record<string, ScreenerColumnLayout>;

export function parseFinvizScreenerHtml(html: string, layout: ScreenerColumnLayout = OVERVIEW_COLUMN_INDEX): ParseResult {
  const $ = cheerio.load(html);
  const stocks: ScrapedStock[] = [];
  let skippedRowCount = 0;

  // Finviz 的 screener 表格列會帶有 data-boxover 或以 "screener_body" 之類的
  // 容器包住；用比較寬鬆的選擇器（抓所有含足夠 <td> 數的資料列）以降低對單一
  // class name 的依賴，同時仍可透過欄位數量與型別驗證過濾掉標題列/廣告列。
  const rowSelectors = ["table.screener_table tbody tr", "tr.styled-row", "table[bgcolor] tr"];
  const seenTickers = new Set<string>();
  const maxColumnIndex = Math.max(layout.volume, layout.priceToBook ?? 0);

  for (const selector of rowSelectors) {
    $(selector).each((_, el) => {
      const tdCells = $(el).find("td");
      if (tdCells.length <= maxColumnIndex) return;

      const cells = tdCells.map((__, td) => $(td).text().trim()).get();

      // 代碼欄位不能直接吃整格文字：沒有公司 Logo 的股票，Finviz 會在代碼連結
      // 前面多塞一個「單字母替代圖示」的文字節點（例如 GWRE 會變成 "G" + "GWRE"），
      // 整格 .text() 會把兩段文字黏在一起變成 "GGWRE"。改成只抓代碼連結本身的
      // 文字，不受這個額外節點影響；找不到連結時才退回整格文字。
      const tickerCell = tdCells.eq(layout.ticker);
      const tickerAnchors = tickerCell.find("a");
      const ticker = (tickerAnchors.length > 0 ? tickerAnchors.last().text().trim() : cells[layout.ticker]) || cells[layout.ticker];
      if (!ticker || seenTickers.has(ticker)) return; // 避免多個選擇器命中同一列造成重複

      const candidate = {
        ticker,
        company: cells[layout.company],
        sector: cells[layout.sector],
        industry: cells[layout.industry],
        country: cells[layout.country],
        marketCapLabel: cells[layout.marketCap],
        marketCapBn: parseMarketCapToBillions(cells[layout.marketCap] ?? ""),
        pe: cells[layout.pe],
        price: parseNumberCell(cells[layout.price] ?? ""),
        change: parseNumberCell(cells[layout.change] ?? ""),
        volume: Math.round(parseNumberCell(cells[layout.volume] ?? "")),
        ...(layout.priceToBook !== undefined ? { priceToBook: cells[layout.priceToBook] } : {}),
      };

      const parsed = scrapedStockSchema.safeParse(candidate);
      if (parsed.success) {
        stocks.push(parsed.data);
        seenTickers.add(ticker);
      } else {
        skippedRowCount += 1;
      }
    });

    if (stocks.length > 0) break; // 找到有效選擇器後不用再嘗試其他候選選擇器
  }


  return { stocks, skippedRowCount };
}
