import { describe, expect, it } from "vitest";
import { formatSessionDate, getListingBadge, type ScreenHistory } from "./screenHistory";

const history: ScreenHistory = {
  sessionDate: "2026-11-17",
  previousSessionDate: "2026-11-14",
  newTickers: ["NEW"],
  dropped: [{ ticker: "OUT", company: "Out Inc" }],
  streaks: { NEW: 1, OLD: 3, MID: 2 },
  sessionsAvailable: 3,
};

describe("getListingBadge", () => {
  it("標記新進與連續天數", () => {
    expect(getListingBadge(history, "NEW")).toEqual({ isNew: true, streak: 1, streakCapped: false });
    expect(getListingBadge(history, "MID")).toEqual({ isNew: false, streak: 2, streakCapped: false });
  });
  it("連續天數到達歷史上限時標記為「至少」", () => {
    expect(getListingBadge(history, "OLD")?.streakCapped).toBe(true);
  });
  it("沒有歷史或不在名單時回傳 null", () => {
    expect(getListingBadge(undefined, "NEW")).toBeNull();
    expect(getListingBadge(history, "ZZZ")).toBeNull();
  });
});

describe("formatSessionDate", () => {
  it("轉成月/日", () => {
    expect(formatSessionDate("2026-11-07")).toBe("11/7");
    expect(formatSessionDate(null)).toBe("—");
  });
});
