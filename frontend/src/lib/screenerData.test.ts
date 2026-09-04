import { describe, expect, it } from "vitest";
import { screens } from "./screenerData";

describe("微型股高空動能策略快照", () => {
  it("與對應 Finviz Overview 的三檔結果一致", () => {
    const microShortScreen = screens.find((screen) => screen.key === "microShort");
    expect(microShortScreen).toMatchObject({
      name: "微型股高空頭動能",
      snapshotTotal: 3,
      snapshotAt: "2026.08.27 · 12:40 ET",
      loadedScope: "Finviz Overview 第 1 頁 · 3 檔",
    });
    expect(microShortScreen?.stocks).toHaveLength(3);
    expect(microShortScreen?.stocks.map((stock) => stock.ticker)).toEqual(["ZCMD", "BTCT", "BRNX"]);
    expect(microShortScreen?.stocks.map((stock) => stock.price)).toEqual([0.88, 2.10, 8.46]);
    expect(microShortScreen?.stocks.map((stock) => stock.change)).toEqual([8.93, 15.75, 35.58]);
  });

  it("保留原始 Finviz 結果的公司、產業與成交量資料", () => {
    const microShortScreen = screens.find((screen) => screen.key === "microShort");
    expect(microShortScreen?.stocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ ticker: "ZCMD", company: "Zhongchao Inc", sector: "Healthcare", industry: "Health Information Services", country: "China", volume: 8873150 }),
      expect.objectContaining({ ticker: "BTCT", company: "BTC Digital Ltd", sector: "Technology", industry: "Computer Hardware", country: "Singapore", volume: 16681702 }),
      expect.objectContaining({ ticker: "BRNX", company: "BrenX Ltd", sector: "Utilities", industry: "Utilities - Renewable", country: "Israel", volume: 6896602 }),
    ]));
  });
});

describe("防禦型收息策略快照", () => {
  const defensiveIncomeScreen = screens.find((screen) => screen.key === "defensiveIncomeValue");

  it("保留 Finviz 快照的完整 71 檔結果與時間基礎", () => {
    expect(defensiveIncomeScreen).toMatchObject({
      name: "穩健收息與價值防禦型多頭",
      snapshotTotal: 71,
      snapshotAt: "2026.08.22 · 01:55–01:59 ET",
    });
    expect(defensiveIncomeScreen?.stocks).toHaveLength(71);
    expect(defensiveIncomeScreen?.stocks.slice(0, 3).map((stock) => stock.ticker)).toEqual(["FPI", "QFIN", "GPK"]);
    expect(defensiveIncomeScreen?.stocks.at(-1)?.ticker).toBe("PNC");
  });

  it("保留依 Finviz 股價遞增的完整名單與四項防禦指標", () => {
    const prices = defensiveIncomeScreen?.stocks.map((stock) => stock.price) ?? [];
    expect(prices).toEqual([...prices].sort((left, right) => left - right));
    expect(defensiveIncomeScreen?.stocks.find((stock) => stock.ticker === "FPI")?.defensiveMetrics).toEqual({ dividendYield: "3.54%", payoutRatio: "42.72%", priceToBook: "0.96", beta: "0.68", snapshotSource: "Finviz" });
    expect(defensiveIncomeScreen?.stocks.find((stock) => stock.ticker === "PNC")?.defensiveMetrics?.payoutRatio).toBe("39.74%");
  });
});

describe("內部人資訊視角", () => {
  it("保留買入與賣出 Finviz 交易快照的來源和時間揭露", () => {
    const insiderScreen = screens.find((screen) => screen.key === "insiderTrading");
    expect(insiderScreen).toMatchObject({
      name: "內部人資訊",
      snapshotAt: "2026.08.22 · 03:50–03:52 ET",
      sourceUrl: "https://finviz.com/insidertrading?tc=1",
    });
    expect(insiderScreen?.filters).toEqual(expect.arrayContaining(["內部人買入交易", "內部人賣出／擬賣出交易", "每區前 10 筆"]));
  });
});

describe("Finviz Top Gainers 與 Top Losers 視角", () => {
  it("保留 Top Gainers 前十名、來源與排序快照", () => {
    const topGainersScreen = screens.find((screen) => screen.key === "topGainers");

    expect(topGainersScreen).toMatchObject({
      sourceUrl: "https://finviz.com/screener?v=111&s=ta_topgainers",
      snapshotAt: "2026.08.22 · 06:22 ET",
      snapshotTotal: 10,
    });
    expect(topGainersScreen?.stocks).toHaveLength(10);
    expect(topGainersScreen?.stocks.slice(0, 3).map((stock) => stock.ticker)).toEqual(["RFAI", "HOWL", "USDE"]);
    expect(topGainersScreen?.stocks.at(-1)).toMatchObject({ ticker: "NCTY", change: 32.57 });
  });

  it("保留 Top Losers 前十名、來源與負漲跌幅快照", () => {
    const topLosersScreen = screens.find((screen) => screen.key === "topLosers");

    expect(topLosersScreen).toMatchObject({
      sourceUrl: "https://finviz.com/screener?v=111&s=ta_toplosers",
      snapshotAt: "2026.08.22 · 06:23 ET",
      snapshotTotal: 10,
    });
    expect(topLosersScreen?.stocks).toHaveLength(10);
    expect(topLosersScreen?.stocks.slice(0, 3).map((stock) => stock.ticker)).toEqual(["MI", "SUGP", "GDC"]);
    expect(topLosersScreen?.stocks.at(-1)).toMatchObject({ ticker: "BTCT", change: -22.45 });
  });
});
