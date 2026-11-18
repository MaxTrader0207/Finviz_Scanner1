import { describe, expect, it } from "vitest";
import { computeForwardReturns, deriveEntries, isDue, parseYahooDailyCloses, summarize } from "./performance";
import { collapseToSessions } from "./screenHistory";
import { evaluateHealth } from "./healthCheck";

const cronAt = (taipeiDate: string) => new Date(`${taipeiDate}T06:00:00+08:00`);
const snap = (at: Date, tickers: string[]) => ({ fetchedAt: at, stocks: tickers.map((ticker, i) => ({ ticker, price: 10 + i })) });

describe("deriveEntries", () => {
  it("每個交易日相對前一日的新進股票各記一筆，最舊一天不算", () => {
    const sessions = collapseToSessions([
      snap(cronAt("2026-11-18"), ["AAA", "CCC"]),
      snap(cronAt("2026-11-17"), ["AAA", "BBB"]),
      snap(cronAt("2026-11-14"), ["BBB"]),
    ]);
    expect(deriveEntries("qm", sessions)).toEqual([
      { screenKey: "qm", ticker: "CCC", sessionDate: "2026-11-17", snapshotPrice: 11 },
      { screenKey: "qm", ticker: "AAA", sessionDate: "2026-11-16", snapshotPrice: 10 },
    ]);
  });
  it("掉出後再進榜會再記一筆", () => {
    const sessions = collapseToSessions([snap(cronAt("2026-11-19"), ["AAA"]), snap(cronAt("2026-11-18"), []), snap(cronAt("2026-11-17"), ["AAA"]), snap(cronAt("2026-11-14"), [])]);
    expect(deriveEntries("qm", sessions).map((entry) => entry.sessionDate)).toEqual(["2026-11-18", "2026-11-16"]);
  });
});

describe("computeForwardReturns", () => {
  const bars = Array.from({ length: 25 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, close: 100 + i }));
  it("以進榜日收盤為基準", () => {
    const result = computeForwardReturns(bars, "2026-10-01");
    expect(result.entryClose).toBe(100);
    expect(result.returns[1]).toBeCloseTo(0.01);
    expect(result.returns[5]).toBeCloseTo(0.05);
    expect(result.returns[20]).toBeCloseTo(0.2);
  });
  it("資料還不夠時回傳 null", () => {
    expect(computeForwardReturns(bars, "2026-10-10").returns[20]).toBeNull();
  });
  it("進榜日沒有 K 棒（假日）時用之前最近一根", () => {
    const gapped = bars.filter((bar) => bar.date !== "2026-10-03");
    expect(computeForwardReturns(gapped, "2026-10-03").entryClose).toBe(101);
  });
  it("進榜日之前完全沒資料時全部 null", () => {
    expect(computeForwardReturns(bars, "2026-09-01")).toEqual({ entryClose: null, returns: { 1: null, 5: null, 20: null } });
  });
});

describe("isDue", () => {
  const now = new Date("2026-11-18T22:30:00Z");
  it("里程碑到期才查", () => {
    expect(isDue({ sessionDate: "2026-11-18", ret1d: null, ret5d: null, ret20d: null }, now)).toBe(false);
    expect(isDue({ sessionDate: "2026-11-17", ret1d: null, ret5d: null, ret20d: null }, now)).toBe(true);
    expect(isDue({ sessionDate: "2026-11-14", ret1d: 0.01, ret5d: null, ret20d: null }, now)).toBe(false);
    expect(isDue({ sessionDate: "2026-11-10", ret1d: 0.01, ret5d: null, ret20d: null }, now)).toBe(true);
    expect(isDue({ sessionDate: "2026-10-25", ret1d: 0.01, ret5d: 0.02, ret20d: null }, now)).toBe(false);
    expect(isDue({ sessionDate: "2026-10-20", ret1d: 0.01, ret5d: 0.02, ret20d: null }, now)).toBe(true);
  });
});

describe("parseYahooDailyCloses", () => {
  it("轉成紐約日期並略過空值", () => {
    const bars = parseYahooDailyCloses({ chart: { result: [{ timestamp: [1763389800, 1763476200, 1763562600], indicators: { quote: [{ close: [10, null, 12] }] } }] } });
    expect(bars).toEqual([{ date: "2025-11-17", close: 10 }, { date: "2025-11-19", close: 12 }]);
  });
});

describe("summarize", () => {
  it("平均、中位數、勝率與超額報酬", () => {
    const stats = summarize([{ ret: 0.1, spy: 0.01 }, { ret: -0.05, spy: 0.01 }, { ret: 0.02, spy: null }, { ret: null, spy: 0.01 }]);
    expect(stats.count).toBe(3);
    expect(stats.mean).toBeCloseTo(0.0233, 3);
    expect(stats.median).toBeCloseTo(0.02);
    expect(stats.winRate).toBeCloseTo(2 / 3);
    expect(stats.excessMean).toBeCloseTo(0.015);
  });
  it("沒有資料時全為 null", () => {
    expect(summarize([])).toEqual({ count: 0, mean: null, median: null, winRate: null, excessMean: null });
  });
});

describe("evaluateHealth", () => {
  const now = new Date("2026-11-19T02:00:00Z");
  const fresh = new Date("2026-11-18T22:05:00Z");
  const old = new Date("2026-11-17T22:05:00Z");
  const base = { now, syncInProgress: false, syncStartedAt: null };

  it("一切正常時沒有問題", () => {
    expect(evaluateHealth({ ...base, lastSuccessfulAt: fresh, screens: [{ key: "a", name: "A", latestFetchedAt: fresh }] })).toEqual([]);
  });
  it("整體超過 26 小時沒同步", () => {
    const issues = evaluateHealth({ ...base, lastSuccessfulAt: old, screens: [{ key: "a", name: "A", latestFetchedAt: old }] });
    expect(issues.map((issue) => issue.kind)).toEqual(["stale-sync"]);
  });
  it("個別視角一直失敗", () => {
    const issues = evaluateHealth({ ...base, lastSuccessfulAt: fresh, screens: [{ key: "a", name: "A", latestFetchedAt: fresh }, { key: "b", name: "B", latestFetchedAt: old }] });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("B");
  });
  it("同步鎖卡住", () => {
    const issues = evaluateHealth({ now, lastSuccessfulAt: fresh, syncInProgress: true, syncStartedAt: new Date("2026-11-19T01:00:00Z"), screens: [] });
    expect(issues.map((issue) => issue.kind)).toEqual(["stuck-lock"]);
  });
});
