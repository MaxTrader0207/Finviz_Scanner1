import { describe, expect, it } from "vitest";
import { parseFinvizInsiderTradingHtml } from "./parseInsiderTrading";

/**
 * 這份 fixture 是依照 parseInsiderTrading.ts 記載的欄位順序手動建立，
 * 不是真實抓下來的 Finviz 頁面。GGAIA 那一列刻意模擬正式環境曾經真實出現過的
 * bug（見 parseScreen.ts 的說明）：沒有公司 Logo 的股票，代碼連結前面會多一個
 * 單字母替代圖示的 <a>，整格 .text() 會把兩段文字黏成 "GGAIA" 而不是 "GAIA"。
 */
const SAMPLE_INSIDER_HTML = `
<html><body>
<table class="body-table">
  <tbody>
    <tr>
      <td><a href="/quote?t=GAIA" class="tab-link-logo">G</a><a href="/quote?t=GAIA" class="tab-link">GAIA</a></td>
      <td>Sutherland Paul Howard</td><td>Director</td><td>Sep 02 '26</td><td>Buy</td>
      <td>1.67</td><td>1,000</td><td>1,670</td><td>1,234,567</td><td><a href="#">Form 4</a></td>
    </tr>
    <tr>
      <td><a href="/quote?t=DDGICA" class="tab-link">DDGICA</a></td>
      <td>DONEGAL MUTUAL INSURANCE CO</td><td>10% Owner</td><td>Sep 03 '26</td><td>Buy</td>
      <td>19.53</td><td>9,595</td><td>187,434</td><td>2,000,000</td><td><a href="#">Form 4</a></td>
    </tr>
  </tbody>
</table>
</body></html>
`;

const EMPTY_INSIDER_HTML = `<html><body><table class="body-table"><tbody></tbody></table></body></html>`;

describe("parseFinvizInsiderTradingHtml", () => {
  it("extracts structured insider transactions in document order", () => {
    const { transactions, skippedRowCount } = parseFinvizInsiderTradingHtml(SAMPLE_INSIDER_HTML);
    expect(transactions.map((t) => t.ticker)).toEqual(["GAIA", "DDGICA"]);
    expect(skippedRowCount).toBe(0);
  });

  it("does not duplicate the leading character when a logo-fallback badge link precedes the ticker link", () => {
    // 正式環境真實出現過的 bug 的最小重現案例：見 fixture 開頭的說明。
    const { transactions } = parseFinvizInsiderTradingHtml(SAMPLE_INSIDER_HTML);
    const gaia = transactions.find((t) => t.owner === "Sutherland Paul Howard");
    expect(gaia?.ticker).toBe("GAIA");
    expect(gaia?.ticker).not.toBe("GGAIA");
  });

  it("parses numeric fields correctly", () => {
    const { transactions } = parseFinvizInsiderTradingHtml(SAMPLE_INSIDER_HTML);
    const ddgica = transactions.find((t) => t.ticker === "DDGICA")!;
    expect(ddgica.cost).toBeCloseTo(19.53);
    expect(ddgica.shares).toBe(9_595);
    expect(ddgica.value).toBeCloseTo(187_434);
    expect(ddgica.relationship).toBe("10% Owner");
  });

  it("returns an empty result (not a throw) for a table with no data rows", () => {
    const { transactions, skippedRowCount } = parseFinvizInsiderTradingHtml(EMPTY_INSIDER_HTML);
    expect(transactions).toEqual([]);
    expect(skippedRowCount).toBe(0);
  });
});
