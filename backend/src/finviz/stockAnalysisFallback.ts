import * as cheerio from "cheerio";

/**
 * stockanalysis.com 的 /statistics/ 頁面沒有擋自動存取（跟 Finviz 不同），
 * 而且把 P/E、P/B、殖利率、配息率、Beta 全部放在同一頁的「標籤 | 數值」
 * 表格列裡（每個區塊是獨立的兩欄表格，例如「Valuation Ratios」「Dividends &
 * Yields」「Stock Price Statistics」）。用標籤文字比對抓值，不用位置索引，
 * 對表格改版比較不敏感。
 *
 * 2026-09-05 用 web_fetch 對照過真實頁面（stockanalysis.com/stocks/pfe/statistics/）
 * 確認過這裡列出的標籤文字。
 */

const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_USER_AGENT = "SignalLedger/1.0 (personal research dashboard; contact: maxwei6699@gmail.com)";

export type StockAnalysisMetrics = {
  pe?: string;
  priceToBook?: string;
  dividendYield?: string;
  payoutRatio?: string;
  beta?: string;
};

const LABELS = {
  pe: "PE Ratio",
  priceToBook: "PB Ratio",
  dividendYield: "Dividend Yield",
  payoutRatio: "Payout Ratio",
  beta: "Beta (5Y)",
} as const;

function extractLabelValue($: cheerio.CheerioAPI, label: string): string | undefined {
  let found: string | undefined;

  $("table tr").each((_, tr) => {
    const cells = $(tr).find("td, th");
    if (cells.length < 2) return;
    const rowLabel = $(cells[0]).text().trim();
    if (rowLabel !== label) return;
    const value = $(cells[1]).text().trim();
    if (value && value.toLowerCase() !== "n/a") found = value;
    return false; // 找到後停止繼續掃描
  });

  return found;
}

export function parseStockAnalysisStatisticsHtml(html: string): StockAnalysisMetrics {
  const $ = cheerio.load(html);
  return {
    pe: extractLabelValue($, LABELS.pe),
    priceToBook: extractLabelValue($, LABELS.priceToBook),
    dividendYield: extractLabelValue($, LABELS.dividendYield),
    payoutRatio: extractLabelValue($, LABELS.payoutRatio),
    beta: extractLabelValue($, LABELS.beta),
  };
}

export async function fetchStockAnalysisMetrics(ticker: string): Promise<StockAnalysisMetrics | null> {
  const url = `https://stockanalysis.com/stocks/${ticker.toLowerCase()}/statistics/`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": REQUEST_USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`stockanalysis.com responded ${response.status}`);
    const html = await response.text();
    return parseStockAnalysisStatisticsHtml(html);
  } catch (error) {
    console.warn(`[StockAnalysis Fallback] Failed to fetch metrics for ${ticker}:`, error);
    return null;
  }
}
