import { describe, expect, it } from "vitest";
import { parseFinvizScreenerHtml, parseMarketCapToBillions, parseValuationPriceToBook } from "./parseScreen";

/**
 * 這份 fixture 是依照 parseScreen.ts 裡記載的欄位順序手動建立，
 * 不是真實抓下來的 Finviz 頁面。實際串接前務必用真實頁面重新產生一份
 * fixture（存成 __fixtures__/finviz-screener-sample.html），
 * 這裡的測試才能真正保護你不被 Finviz 改版影響。
 *
 * ALM 那一列刻意模擬了實際上線後才發現的真實 bug：沒有公司 Logo 的股票，
 * Finviz 會在代碼連結前面多一個「單字母替代圖示」的 <a>，如果解析邏輯直接
 * 抓整格 .text()，會把兩段文字黏成 "AALM" 而不是正確的 "ALM"。
 */
const SAMPLE_SCREENER_HTML = `
<html><body>
<table class="screener_table">
  <thead><tr><th>No.</th><th>Ticker</th><th>Company</th><th>Sector</th><th>Industry</th><th>Country</th><th>Market Cap</th><th>P/E</th><th>Price</th><th>Change</th><th>Volume</th></tr></thead>
  <tbody>
    <tr><td>1</td><td><a href="/quote?t=ALM" class="tab-link-logo">A</a><a href="/quote?t=ALM" class="tab-link">ALM</a></td><td>Almonty Industries Inc</td><td>Basic Materials</td><td>Other Industrial Metals & Mining</td><td>USA</td><td>5.10B</td><td>72.15</td><td>17.69</td><td>9.33%</td><td>10,509,362</td></tr>
    <tr><td>2</td><td><a href="/quote?t=AUPH" class="tab-link">AUPH</a></td><td>Aurinia Pharmaceuticals Inc</td><td>Healthcare</td><td>Biotechnology</td><td>Canada</td><td>2.30B</td><td>7.55</td><td>17.27</td><td>6.80%</td><td>2,637,100</td></tr>
    <tr><td>3</td><td><a href="/quote?t=DOW" class="tab-link">DOW</a></td><td>Dow Inc</td><td>Basic Materials</td><td>Chemicals</td><td>USA</td><td>23.77B</td><td>-</td><td>32.90</td><td>3.62%</td><td>14,366,264</td></tr>
  </tbody>
</table>
</body></html>
`;

const EMPTY_TABLE_HTML = `<html><body><table class="screener_table"><tbody></tbody></table></body></html>`;

/**
 * Valuation 檢視（v=121）**沒有** Company/Sector/Industry/Country 欄位，
 * 跟 Overview 完全不同的表格結構。這份 fixture 的欄位順序是 2026-09-04
 * 對照登入後的真實 Finviz 頁面截圖確認過的：
 * No. / Ticker / Market Cap / P/E / Fwd P/E / PEG / P/S / P/B / P/C / P/FCF /
 * EPS this Y / EPS next Y / EPS past 5Y / EPS next 5Y / Sales past 5Y /
 * Price / Change / Volume（共 18 欄，索引 0-17）。
 */
const VALUATION_SCREENER_HTML = `
<html><body>
<table class="screener_table">
  <tbody>
    <tr>
      <td>1</td><td><a href="/quote?t=AUPH" class="tab-link">AUPH</a></td><td>2.30B</td><td>7.55</td>
      <td>9.10</td><td>1.20</td><td>3.40</td><td>1.85</td><td>5.60</td><td>18.20</td>
      <td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>
      <td>17.27</td><td>6.80%</td><td>2,637,100</td>
    </tr>
  </tbody>
</table>
</body></html>
`;

describe("parseFinvizScreenerHtml", () => {
  it("extracts structured stock rows in document order", () => {
    const { stocks, skippedRowCount } = parseFinvizScreenerHtml(SAMPLE_SCREENER_HTML);
    expect(stocks.map((stock) => stock.ticker)).toEqual(["ALM", "AUPH", "DOW"]);
    expect(skippedRowCount).toBe(0);
  });

  it("does not duplicate the leading character when a logo-fallback badge link precedes the ticker link", () => {
    // 上線後在真實資料裡發現的 bug（GWRE 被誤判成 GGWRE、LULU 變成 LLULU）
    // 的最小重現案例：ALM 那一列的代碼欄位有兩個 <a>，第一個是 Logo 替代
    // 圖示（只有 "A" 一個字），第二個才是真正的代碼連結。
    const { stocks } = parseFinvizScreenerHtml(SAMPLE_SCREENER_HTML);
    const alm = stocks.find((stock) => stock.company === "Almonty Industries Inc");
    expect(alm?.ticker).toBe("ALM");
    expect(alm?.ticker).not.toBe("AALM");
  });

  it("parses numeric fields correctly, including missing P/E", () => {
    const { stocks } = parseFinvizScreenerHtml(SAMPLE_SCREENER_HTML);
    const alm = stocks.find((stock) => stock.ticker === "ALM")!;
    expect(alm.price).toBeCloseTo(17.69);
    expect(alm.change).toBeCloseTo(9.33);
    expect(alm.volume).toBe(10_509_362);
    expect(alm.marketCapBn).toBeCloseTo(5.1);

    const dow = stocks.find((stock) => stock.ticker === "DOW")!;
    expect(dow.pe).toBe("-");
  });

  it("returns an empty result (not a throw) for a table with no data rows", () => {
    const { stocks, skippedRowCount } = parseFinvizScreenerHtml(EMPTY_TABLE_HTML);
    expect(stocks).toEqual([]);
    expect(skippedRowCount).toBe(0);
  });
});

describe("parseValuationPriceToBook", () => {
  it("extracts a ticker -> P/B map from the Valuation view's column layout", () => {
    const result = parseValuationPriceToBook(VALUATION_SCREENER_HTML);
    expect(result.get("AUPH")).toBe("1.85");
    expect(result.size).toBe(1);
  });

  it("returns an empty map for a table with no data rows", () => {
    const result = parseValuationPriceToBook(EMPTY_TABLE_HTML);
    expect(result.size).toBe(0);
  });
});

describe("parseMarketCapToBillions", () => {
  it("converts B/M/K suffixes to a billions-denominated number", () => {
    expect(parseMarketCapToBillions("5.10B")).toBeCloseTo(5.1);
    expect(parseMarketCapToBillions("483.94M")).toBeCloseTo(0.48394);
    expect(parseMarketCapToBillions("19.94M")).toBeCloseTo(0.01994);
  });

  it("returns 0 for missing or unparsable labels", () => {
    expect(parseMarketCapToBillions("—")).toBe(0);
    expect(parseMarketCapToBillions("")).toBe(0);
  });
});
