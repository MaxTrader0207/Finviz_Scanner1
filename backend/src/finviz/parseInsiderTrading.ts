import * as cheerio from "cheerio";
import { z } from "zod";

/**
 * 解析 https://finviz.com/insidertrading.ashx?tc=1 這類頁面的 Form 4 交易表格。
 * 跟 parseScreen.ts 同樣的理由：獨立成純函式方便用 fixture 測試、方便未來改版時
 * 只改這一個檔案。
 */

export const scrapedInsiderTransactionSchema = z.object({
  ticker: z.string().regex(/^[A-Z.]{1,10}$/),
  owner: z.string().min(1),
  relationship: z.string().min(1),
  date: z.string().min(1),
  transaction: z.string().min(1),
  cost: z.number().finite().nonnegative(),
  shares: z.number().int().nonnegative(),
  value: z.number().finite().nonnegative(),
});

export type ScrapedInsiderTransaction = z.infer<typeof scrapedInsiderTransactionSchema>;

/**
 * Finviz insider trading 表格欄位順序：
 * Ticker / Owner / Relationship / Date / Transaction / Cost / #Shares / Value ($) / #Shares Total / SEC Form 4
 */
const COLUMN_INDEX = {
  ticker: 0,
  owner: 1,
  relationship: 2,
  date: 3,
  transaction: 4,
  cost: 5,
  shares: 6,
  value: 7,
} as const;

function parseNumberCell(text: string): number {
  return Number(text.replace(/[%,$]/g, "").trim());
}

export function parseFinvizInsiderTradingHtml(html: string): {
  transactions: ScrapedInsiderTransaction[];
  skippedRowCount: number;
} {
  const $ = cheerio.load(html);
  const transactions: ScrapedInsiderTransaction[] = [];
  let skippedRowCount = 0;

  $("table.body-table tbody tr, table.styled-table-new tr").each((_, el) => {
    const tdCells = $(el).find("td");
    if (tdCells.length <= COLUMN_INDEX.value) return;

    const cells = tdCells.map((__, td) => $(td).text().trim()).get();

    // 同樣的代碼欄位問題（見 parseScreen.ts 的說明）：沒有 Logo 的股票，
    // 代碼連結前面會多一個單字母替代圖示的文字節點，導致整格文字被黏成
    // 重複開頭字母（例如 "GAIA" 變成 "GGAIA"）。改成只抓連結本身的文字。
    const tickerCell = tdCells.eq(COLUMN_INDEX.ticker);
    const tickerAnchors = tickerCell.find("a");
    const ticker = (tickerAnchors.length > 0 ? tickerAnchors.last().text().trim() : cells[COLUMN_INDEX.ticker]) || cells[COLUMN_INDEX.ticker];

    const candidate = {
      ticker,
      owner: cells[COLUMN_INDEX.owner],
      relationship: cells[COLUMN_INDEX.relationship],
      date: cells[COLUMN_INDEX.date],
      transaction: cells[COLUMN_INDEX.transaction],
      cost: parseNumberCell(cells[COLUMN_INDEX.cost] ?? ""),
      shares: Math.round(parseNumberCell(cells[COLUMN_INDEX.shares] ?? "")),
      value: parseNumberCell(cells[COLUMN_INDEX.value] ?? ""),
    };

    const parsed = scrapedInsiderTransactionSchema.safeParse(candidate);
    if (parsed.success) transactions.push(parsed.data);
    else skippedRowCount += 1;
  });

  return { transactions, skippedRowCount };
}
