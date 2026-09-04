import { describe, expect, it } from "vitest";
import { getInsiderSectorComposition, getInsiderTickerSector, getTopInsiderTransactions, insiderBuyTransactions, insiderSaleTransactions } from "./insiderTrading";

describe("內部人交易排序快照", () => {
  it("買入交易可依股數顯示前十名並支援高低排序", () => {
    expect(getTopInsiderTransactions(insiderBuyTransactions, "shares", "desc")).toHaveLength(10);
    expect(getTopInsiderTransactions(insiderBuyTransactions, "shares", "desc")[0]).toMatchObject({ ticker: "ZNTL", shares: 4_335_000 });
    expect(getTopInsiderTransactions(insiderBuyTransactions, "shares", "asc")[0]).toMatchObject({ ticker: "TPL", shares: 1 });
  });

  it("買入交易可依交易金額顯示前十名並支援高低排序", () => {
    expect(getTopInsiderTransactions(insiderBuyTransactions, "value", "desc")[0]).toMatchObject({ ticker: "RSG", value: 43_607_661 });
    expect(getTopInsiderTransactions(insiderBuyTransactions, "value", "asc")[0]).toMatchObject({ ticker: "MDRR", value: 34 });
  });

  it("賣出交易可依股數與交易金額的雙向排序取前十名", () => {
    expect(getTopInsiderTransactions(insiderSaleTransactions, "shares", "desc")[0]).toMatchObject({ ticker: "DGNX", shares: 6_908_540 });
    expect(getTopInsiderTransactions(insiderSaleTransactions, "shares", "asc")[0]).toMatchObject({ ticker: "ISRG", shares: 77 });
    expect(getTopInsiderTransactions(insiderSaleTransactions, "value", "desc")[0]).toMatchObject({ ticker: "CBRS", value: 147_628_770 });
    expect(getTopInsiderTransactions(insiderSaleTransactions, "value", "asc")[0]).toMatchObject({ ticker: "ZSTK", value: 7_570 });
  });

  it("以去重後的交易代碼彙整 Finviz 產業構成並保留未分類項目", () => {
    const composition = getInsiderSectorComposition([insiderBuyTransactions[0], insiderBuyTransactions[1], insiderBuyTransactions[13]]);
    expect(composition.find((item) => item.sector === "Healthcare")).toMatchObject({ count: 1 });
    expect(composition.find((item) => item.sector === "Basic Materials")).toMatchObject({ count: 1 });
    expect(composition.find((item) => item.sector === "未分類")).toMatchObject({ count: 1 });
    expect(composition.reduce((total, item) => total + item.percentage, 0)).toBeCloseTo(100);
  });

  it("提供內部人交易代碼的 Finviz 產業或未分類標記，供自選股清單使用", () => {
    expect(getInsiderTickerSector("zntl")).toBe("Healthcare");
    expect(getInsiderTickerSector("EENHA")).toBe("未分類");
  });
});
