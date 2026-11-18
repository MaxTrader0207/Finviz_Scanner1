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
  /** 以下三個欄位來自自訂欄位檢視（見 SCREEN_METRIC_COLUMNS），沒配息的股票不會有 dividendYield。 */
  dividendYield: z.string().min(1).optional(),
  payoutRatio: z.string().min(1).optional(),
  beta: z.string().min(1).optional(),
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
};

/**
 * 2026-10 中 Finviz 把 screener 改成前端渲染：HTML 裡已經沒有 <table>，資料改放在
 * `<script type="application/json" data-ssr-props="ssr-island-N">` 的 JSON 裡：
 *   { selectedColumns: [...], data: { rows: [{ text: {ticker, company, sector, ...},
 *     numbers: {marketCap(百萬美元), PE, price, change(%), volume, PB, ...} }], totalCount, firstRow, pageSize } }
 * 這是 2026-11-18 對照真實頁面確認的結構。找不到這段 JSON 時回傳 null，呼叫端再退回舊的表格解析。
 */
type FinvizJsonRow = { text?: Record<string, unknown>; numbers?: Record<string, unknown> };

export function extractScreenerJsonRows(html: string): FinvizJsonRow[] | null {
  const $ = cheerio.load(html);
  let rows: FinvizJsonRow[] | null = null;
  $('script[type="application/json"]').each((_, el) => {
    if (rows) return;
    const raw = $(el).text();
    if (!raw.includes('"rows"')) return;
    try {
      const parsed = JSON.parse(raw) as { data?: { rows?: unknown } };
      if (Array.isArray(parsed?.data?.rows)) rows = parsed.data.rows as FinvizJsonRow[];
    } catch {
      // 不是我們要的那段 JSON，繼續找下一個
    }
  });
  return rows;
}

const asNumber = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const asText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** 百萬美元 -> "5.97B" / "466.06M"，跟舊表格的顯示格式一致。 */
export function formatMarketCapMillions(millions: number | null): string {
  if (millions === null || millions <= 0) return "-";
  return millions >= 1000 ? `${(millions / 1000).toFixed(2)}B` : `${millions.toFixed(2)}M`;
}

function metricFields(numbers: Record<string, unknown>) {
  const dividend = asNumber(numbers.dividendYield);
  const payout = asNumber(numbers.payoutRatio);
  const beta = asNumber(numbers.beta);
  return {
    ...(dividend !== null ? { dividendYield: `${dividend.toFixed(2)}%` } : {}),
    ...(payout !== null ? { payoutRatio: `${payout.toFixed(2)}%` } : {}),
    ...(beta !== null ? { beta: beta.toFixed(2) } : {}),
  };
}

/**
 * 每個視角都改用 Finviz 自訂欄位檢視（v=152）抓取：跟 Overview 同樣的欄位，再加上 P/B、
 * 殖利率、配息率、Beta，一個請求就拿到股票卡片要的五項指標。欄位代號 2026-11-18 對照真實頁面確認：
 * 1 Ticker / 2 Company / 3 Sector / 4 Industry / 5 Country / 6 Market Cap / 7 P/E / 11 P/B /
 * 14 Dividend Yield / 15 Payout Ratio / 48 Beta / 65 Price / 66 Change / 67 Volume
 */
export const SCREEN_METRIC_COLUMNS = "1,2,3,4,5,6,7,11,14,15,48,65,66,67";

/** 把視角的 Overview 網址（v=111）轉成帶指標欄位的自訂檢視網址；sourceUrl 本身維持原樣給使用者點。 */
export function toMetricsViewUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  url.searchParams.set("v", "152");
  url.searchParams.set("c", SCREEN_METRIC_COLUMNS);
  return url.toString();
}

function parseJsonRows(rows: FinvizJsonRow[]): ParseResult {
  const stocks: ScrapedStock[] = [];
  let skippedRowCount = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const text = row.text ?? {};
    const numbers = row.numbers ?? {};
    const ticker = asText(text.ticker);
    if (!ticker || seen.has(ticker)) continue;
    const marketCapMillions = asNumber(numbers.marketCap);
    const pe = asNumber(numbers.PE);
    const priceToBook = asNumber(numbers.PB);
    const candidate = {
      ticker,
      company: asText(text.company),
      sector: asText(text.sector) || "-",
      industry: asText(text.industry) || "-",
      country: asText(text.country) || "-",
      marketCapLabel: formatMarketCapMillions(marketCapMillions),
      marketCapBn: marketCapMillions !== null ? marketCapMillions / 1000 : 0,
      pe: pe !== null ? pe.toFixed(2) : "-",
      price: asNumber(numbers.price) ?? Number.NaN,
      change: asNumber(numbers.change) ?? 0,
      volume: Math.round(asNumber(numbers.volume) ?? 0),
      ...(priceToBook !== null ? { priceToBook: priceToBook.toFixed(2) } : {}),
      ...metricFields(numbers),
    };
    const parsed = scrapedStockSchema.safeParse(candidate);
    if (parsed.success) {
      stocks.push(parsed.data);
      seen.add(ticker);
    } else {
      skippedRowCount += 1;
    }
  }
  return { stocks, skippedRowCount };
}

export function parseFinvizScreenerHtml(html: string, layout: ScreenerColumnLayout = OVERVIEW_COLUMN_INDEX): ParseResult {
  const jsonRows = extractScreenerJsonRows(html);
  if (jsonRows) return parseJsonRows(jsonRows);

  const $ = cheerio.load(html);
  const stocks: ScrapedStock[] = [];
  let skippedRowCount = 0;

  // Finviz 的 screener 表格列會帶有 data-boxover 或以 "screener_body" 之類的
  // 容器包住；用比較寬鬆的選擇器（抓所有含足夠 <td> 數的資料列）以降低對單一
  // class name 的依賴，同時仍可透過欄位數量與型別驗證過濾掉標題列/廣告列。
  const rowSelectors = ["table.screener_table tbody tr", "tr.styled-row", "table[bgcolor] tr"];
  const seenTickers = new Set<string>();

  for (const selector of rowSelectors) {
    $(selector).each((_, el) => {
      const tdCells = $(el).find("td");
      if (tdCells.length <= layout.volume) return;

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

/**
 * Finviz screener Valuation 表格欄位順序（v=121 檢視）。這個檢視**沒有**
 * Company/Sector/Industry/Country 欄位（跟 Overview 不同），欄位是：
 * No. / Ticker / Market Cap / P/E / Fwd P/E / PEG / P/S / P/B / P/C / P/FCF /
 * EPS this Y / EPS next Y / EPS past 5Y / EPS next 5Y / Sales past 5Y /
 * Price / Change / Volume
 *
 * 這組索引是 2026-09-04 對照真實登入後的 Finviz 頁面截圖確認過的（不是猜測）。
 */
const VALUATION_TICKER_INDEX = 1;
const VALUATION_PRICE_TO_BOOK_INDEX = 7;

/**
 * 因為 Valuation 檢視沒有 Company/Sector/Industry/Country，沒辦法套用完整的
 * scrapedStockSchema，所以獨立成一個只抓「代碼 -> P/B」對照表的函式。呼叫端
 * （fetchScreen.ts）會用這個表，依代碼把 P/B 併回 Overview 檢視抓到的完整資料。
 */
export type DefensiveMetrics = { priceToBook?: string; dividendYield?: string; payoutRatio?: string; beta?: string };

/**
 * 防禦型視角的補充指標：用 Finviz 自訂欄位檢視（v=152&c=1,11,14,15,48 → Ticker、P/B、
 * Dividend Yield、Payout Ratio、Beta）一次取得。2026-11-18 對照真實頁面確認 JSON 欄位名稱
 * 為 PB / dividendYield / payoutRatio / beta（後兩個百分比欄位是百分比數值，例如 4.18 = 4.18%）。
 */
export function parseDefensiveMetrics(html: string): Map<string, DefensiveMetrics> {
  const result = new Map<string, DefensiveMetrics>();
  const jsonRows = extractScreenerJsonRows(html);
  if (!jsonRows) {
    for (const [ticker, priceToBook] of parseValuationPriceToBook(html)) result.set(ticker, { priceToBook });
    return result;
  }
  for (const row of jsonRows) {
    const ticker = asText(row.text?.ticker);
    if (!ticker || result.has(ticker)) continue;
    const pb = asNumber(row.numbers?.PB);
    const dividend = asNumber(row.numbers?.dividendYield);
    const payout = asNumber(row.numbers?.payoutRatio);
    const beta = asNumber(row.numbers?.beta);
    result.set(ticker, {
      ...(pb !== null ? { priceToBook: pb.toFixed(2) } : {}),
      ...(dividend !== null ? { dividendYield: `${dividend.toFixed(2)}%` } : {}),
      ...(payout !== null ? { payoutRatio: `${payout.toFixed(2)}%` } : {}),
      ...(beta !== null ? { beta: beta.toFixed(2) } : {}),
    });
  }
  return result;
}

export function parseValuationPriceToBook(html: string): Map<string, string> {
  const jsonRows = extractScreenerJsonRows(html);
  if (jsonRows) {
    const fromJson = new Map<string, string>();
    for (const row of jsonRows) {
      const ticker = asText(row.text?.ticker);
      const priceToBook = asNumber(row.numbers?.PB);
      if (ticker && priceToBook !== null && !fromJson.has(ticker)) fromJson.set(ticker, priceToBook.toFixed(2));
    }
    return fromJson;
  }

  const $ = cheerio.load(html);
  const result = new Map<string, string>();
  const rowSelectors = ["table.screener_table tbody tr", "tr.styled-row", "table[bgcolor] tr"];

  for (const selector of rowSelectors) {
    $(selector).each((_, el) => {
      const tdCells = $(el).find("td");
      if (tdCells.length <= VALUATION_PRICE_TO_BOOK_INDEX) return;

      const cells = tdCells.map((__, td) => $(td).text().trim()).get();
      const tickerCell = tdCells.eq(VALUATION_TICKER_INDEX);
      const tickerAnchors = tickerCell.find("a");
      const ticker = (tickerAnchors.length > 0 ? tickerAnchors.last().text().trim() : cells[VALUATION_TICKER_INDEX]) || cells[VALUATION_TICKER_INDEX];
      const priceToBook = cells[VALUATION_PRICE_TO_BOOK_INDEX];

      if (ticker && priceToBook && !result.has(ticker)) {
        result.set(ticker, priceToBook);
      }
    });

    if (result.size > 0) break;
  }

  return result;
}
