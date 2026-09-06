import { describe, expect, it } from "vitest";
import { parseStockAnalysisStatisticsHtml } from "./stockAnalysisFallback";

/**
 * 這份 fixture 依照 2026-09-05 用 web_fetch 對照過的真實頁面
 * （stockanalysis.com/stocks/pfe/statistics/）結構簡化建立：每個區塊是獨立的
 * 兩欄表格，第一欄是標籤文字，第二欄是數值。
 */
const STATISTICS_HTML = `
<html><body>
<h2>Valuation Ratios</h2>
<table>
  <tr><td>PE Ratio</td><td>37.40</td></tr>
  <tr><td>Forward PE</td><td>10.27</td></tr>
  <tr><td>PS Ratio</td><td>2.55</td></tr>
  <tr><td>PB Ratio</td><td>1.90</td></tr>
  <tr><td>PEG Ratio</td><td>n/a</td></tr>
</table>
<h2>Stock Price Statistics</h2>
<table>
  <tr><td>Beta (5Y)</td><td>0.30</td></tr>
  <tr><td>52-Week Price Change</td><td>+14.76%</td></tr>
</table>
<h2>Dividends &amp; Yields</h2>
<table>
  <tr><td>Dividend Per Share</td><td>$1.72</td></tr>
  <tr><td>Dividend Yield</td><td>6.05%</td></tr>
  <tr><td>Payout Ratio</td><td>226.35%</td></tr>
</table>
</body></html>
`;

const EMPTY_HTML = `<html><body><p>No data</p></body></html>`;

describe("parseStockAnalysisStatisticsHtml", () => {
  it("extracts all five metrics by matching row labels across separate tables", () => {
    const metrics = parseStockAnalysisStatisticsHtml(STATISTICS_HTML);
    expect(metrics).toEqual({
      pe: "37.40",
      priceToBook: "1.90",
      dividendYield: "6.05%",
      payoutRatio: "226.35%",
      beta: "0.30",
    });
  });

  it("treats 'n/a' values as missing rather than a literal string", () => {
    const html = `<table><tr><td>PB Ratio</td><td>n/a</td></tr></table>`;
    const metrics = parseStockAnalysisStatisticsHtml(html);
    expect(metrics.priceToBook).toBeUndefined();
  });

  it("returns all-undefined metrics (not a throw) when no matching rows exist", () => {
    const metrics = parseStockAnalysisStatisticsHtml(EMPTY_HTML);
    expect(metrics).toEqual({
      pe: undefined,
      priceToBook: undefined,
      dividendYield: undefined,
      payoutRatio: undefined,
      beta: undefined,
    });
  });
});
