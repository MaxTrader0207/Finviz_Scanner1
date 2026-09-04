import { describe, expect, it } from "vitest";
import { defensivePageCount, defensivePageSlice, DEFENSIVE_PAGE_SIZE, DEFENSIVE_QUICK_SECTORS, nextVisibleDefensiveCount, visibleDefensiveCount } from "./defensiveScreenUtils";

describe("防禦型策略分頁與快速產業篩選", () => {
  it("每次載入 20 檔，且不會超過 71 檔快照上限", () => {
    expect(DEFENSIVE_PAGE_SIZE).toBe(20);
    expect(nextVisibleDefensiveCount(20, 71)).toBe(40);
    expect(nextVisibleDefensiveCount(60, 71)).toBe(71);
    expect(visibleDefensiveCount(99, 71)).toBe(71);
  });

  it("以固定分頁維持每頁至多 20 檔，並保留最後一頁餘數", () => {
    const items = Array.from({ length: 71 }, (_, index) => index + 1);
    expect(defensivePageCount(items.length)).toBe(4);
    expect(defensivePageSlice(items, 1)).toHaveLength(20);
    expect(defensivePageSlice(items, 4)).toEqual(items.slice(60));
    expect(defensivePageSlice(items, 99)).toEqual(items.slice(60));
  });

  it("提供金融、電信與公用事業防禦產業捷徑", () => {
    expect(DEFENSIVE_QUICK_SECTORS).toEqual([
      { value: "Financial", label: "金融" },
      { value: "Communication Services", label: "電信" },
      { value: "Utilities", label: "公用事業" },
    ]);
  });
});
