import { describe, expect, it } from "vitest";
import { getSectorChartAxisMax, getWatchlistSectorComposition, sortSectorComposition } from "./watchlistComposition";

describe("自選股產業構成", () => {
  it("計算各產業檔數、百分比並依佔比排序", () => {
    expect(getWatchlistSectorComposition([{ sector: "Financial" }, { sector: "Energy" }, { sector: "Financial" }])).toEqual([
      { sector: "Financial", count: 2, percentage: 66.7 },
      { sector: "Energy", count: 1, percentage: 33.3 },
    ]);
  });

  it("空清單回傳空產業構成", () => {
    expect(getWatchlistSectorComposition([])).toEqual([]);
  });

  it("可按佔比由高至低或低至高重新排序", () => {
    const composition = getWatchlistSectorComposition([{ sector: "Financial" }, { sector: "Energy" }, { sector: "Financial" }]);
    expect(sortSectorComposition(composition, "desc").map((item) => item.sector)).toEqual(["Financial", "Energy"]);
    expect(sortSectorComposition(composition, "asc").map((item) => item.sector)).toEqual(["Energy", "Financial"]);
  });

  it("為單一與多產業長條圖保留右側百分比標籤空間", () => {
    expect(getSectorChartAxisMax([{ sector: "Energy", count: 1, percentage: 100 }])).toBe(1.25);
    expect(getSectorChartAxisMax([{ sector: "Financial", count: 4, percentage: 80 }, { sector: "Energy", count: 1, percentage: 20 }])).toBe(5);
  });
});
