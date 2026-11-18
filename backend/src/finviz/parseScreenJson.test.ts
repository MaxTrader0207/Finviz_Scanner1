import { describe, expect, it } from "vitest";
import { extractScreenerJsonRows, formatMarketCapMillions, parseFinvizScreenerHtml, parseValuationPriceToBook } from "./parseScreen";

// 依 2026-11-18 真實 Finviz 頁面的結構縮減而成（欄位與數值取自實際回應）。
const page = (rows: unknown[], extra = "") => `<!doctype html><html><body>
<div id="root"></div>
<script type="application/json" data-ssr-props="ssr-island-0">{"nav":true}</script>
<script type="application/json" data-ssr-props="ssr-island-1">${JSON.stringify({
  url: "/screener/stocks?v=111",
  screenerType: "stocks",
  selectedColumns: ["row", "ticker", "company", "sector", "industry", "country", "marketCap", "PE", "price", "change", "volume"],
  data: { rows, totalCount: rows.length, firstRow: 0, pageSize: 20 },
})}</script>${extra}</body></html>`;

const TME = {
  text: { ticker: "TME", company: "Tencent Music Entertainment Group ADR", sector: "Communication Services", industry: "Internet Content & Information", securityType: "Stock", country: "China", type: "stock" },
  numbers: { marketCap: 5972.82386841774, PE: 11.346753255486231, prevClose: 8.88, price: 9.470000267028809, change: 6.644145776849886, volume: 13730900, order: 0 },
};
const SLS = {
  text: { ticker: "SLS", company: "SELLAS Life Sciences Group Inc", sector: "Healthcare", industry: "Biotechnology", country: "USA" },
  numbers: { marketCap: 3903.908264813789, price: 19.149999618530273, change: 156.3587705005673, volume: 120291755, order: 1 },
};

describe("Finviz 新版 JSON 頁面", () => {
  it("解析股票列", () => {
    const { stocks, skippedRowCount } = parseFinvizScreenerHtml(page([TME, SLS]));
    expect(skippedRowCount).toBe(0);
    expect(stocks).toHaveLength(2);
    expect(stocks[0]).toEqual({
      ticker: "TME",
      company: "Tencent Music Entertainment Group ADR",
      sector: "Communication Services",
      industry: "Internet Content & Information",
      country: "China",
      marketCapLabel: "5.97B",
      marketCapBn: 5.97282386841774,
      pe: "11.35",
      price: 9.470000267028809,
      change: 6.644145776849886,
      volume: 13730900,
    });
    expect(stocks[1]!.pe).toBe("-"); // 虧損公司沒有 P/E
  });

  it("條件交集為 0 檔時回傳空陣列（而不是退回表格解析）", () => {
    expect(extractScreenerJsonRows(page([]))).toEqual([]);
    expect(parseFinvizScreenerHtml(page([])).stocks).toEqual([]);
  });

  it("缺價格的列會被略過並計數", () => {
    const broken = { text: { ticker: "BAD", company: "Bad Co", sector: "x", industry: "x", country: "USA" }, numbers: { marketCap: 1 } };
    const result = parseFinvizScreenerHtml(page([TME, broken]));
    expect(result.stocks.map((stock) => stock.ticker)).toEqual(["TME"]);
    expect(result.skippedRowCount).toBe(1);
  });

  it("Valuation 檢視讀 PB 欄位", () => {
    const GPK = { text: { ticker: "GPK", company: "Graphic Packaging Holding Co" }, numbers: { PB: 0.9715346328775499, price: 10.52 } };
    expect(parseValuationPriceToBook(page([GPK]))).toEqual(new Map([["GPK", "0.97"]]));
  });

  it("沒有 JSON 時仍退回舊的表格解析", () => {
    expect(extractScreenerJsonRows("<html><table class='screener_table'></table></html>")).toBeNull();
  });
});

describe("formatMarketCapMillions", () => {
  it("十億以上用 B，以下用 M", () => {
    expect(formatMarketCapMillions(116250)).toBe("116.25B");
    expect(formatMarketCapMillions(466.0622)).toBe("466.06M");
    expect(formatMarketCapMillions(null)).toBe("-");
  });
});

import { parseDefensiveMetrics } from "./parseScreen";

describe("parseDefensiveMetrics", () => {
  it("讀自訂檢視的 P/B、殖利率、配息率、Beta", () => {
    const GPK = { text: { ticker: "GPK" }, numbers: { PB: 0.9715346328775499, dividendYield: 4.183554951038072, payoutRatio: 29.71, beta: 0.5961256965156342, price: 10.52 } };
    const NOBETA = { text: { ticker: "XYZ" }, numbers: { PB: 1.5, price: 20 } };
    expect(parseDefensiveMetrics(page([GPK, NOBETA]))).toEqual(new Map([
      ["GPK", { priceToBook: "0.97", dividendYield: "4.18%", payoutRatio: "29.71%", beta: "0.60" }],
      ["XYZ", { priceToBook: "1.50" }],
    ]));
  });
});

import { toMetricsViewUrl } from "./parseScreen";

describe("每個視角都帶上卡片指標", () => {
  it("把 Overview 網址轉成自訂欄位檢視，其他條件不變", () => {
    const url = new URL(toMetricsViewUrl("https://finviz.com/screener?v=111&f=cap_midover,fa_epsqoq_pos&o=price"));
    expect(url.searchParams.get("v")).toBe("152");
    expect(url.searchParams.get("c")).toBe("1,2,3,4,5,6,7,11,14,15,48,65,66,67");
    expect(url.searchParams.get("f")).toBe("cap_midover,fa_epsqoq_pos");
    expect(url.searchParams.get("o")).toBe("price");
  });

  it("解析殖利率、配息率、Beta（沒配息的股票不會有殖利率）", () => {
    const TME = { text: { ticker: "TME", company: "Tencent Music", sector: "Communication Services", industry: "Internet", country: "China" }, numbers: { marketCap: 5972.8, PE: 11.35, PB: 1.2012, dividendYield: 1.93548, payoutRatio: 23.21, beta: 0.69925, price: 9.47, change: 6.64, volume: 13730900 } };
    const SLS = { text: { ticker: "SLS", company: "SELLAS", sector: "Healthcare", industry: "Biotechnology", country: "USA" }, numbers: { marketCap: 3903.9, PB: 29.57, beta: 2.758, price: 19.15, change: 156.36, volume: 120291755 } };
    const [tme, sls] = parseFinvizScreenerHtml(page([TME, SLS])).stocks;
    expect(tme).toMatchObject({ priceToBook: "1.20", dividendYield: "1.94%", payoutRatio: "23.21%", beta: "0.70" });
    expect(sls).toMatchObject({ priceToBook: "29.57", beta: "2.76" });
    expect(sls!.dividendYield).toBeUndefined();
  });
});
