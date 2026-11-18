import { describe, expect, it } from "vitest";
import { computeScreenHistory, toUsSessionDate } from "./screenHistory";
import { buildDailyDigest } from "./dailyDigest";
import { splitMessage } from "../notify";

// 台灣時間 06:00 cron = UTC 22:00 前一天
const cronAt = (taipeiDate: string) => new Date(`${taipeiDate}T06:00:00+08:00`);
const snap = (at: Date, tickers: string[]) => ({ fetchedAt: at, stocks: tickers.map((ticker) => ({ ticker, company: `${ticker} Inc` })) });

describe("toUsSessionDate", () => {
  it("台灣早上 cron 歸到前一個美股交易日", () => {
    expect(toUsSessionDate(cronAt("2026-11-18"))).toBe("2026-11-17"); // 週三早上 → 週二收盤
  });
  it("週六、週日、週一早上的 cron 都歸到週五", () => {
    expect(toUsSessionDate(cronAt("2026-11-14"))).toBe("2026-11-13");
    expect(toUsSessionDate(cronAt("2026-11-15"))).toBe("2026-11-13");
    expect(toUsSessionDate(cronAt("2026-11-16"))).toBe("2026-11-13");
  });
  it("美股盤中手動同步歸到當天", () => {
    expect(toUsSessionDate(new Date("2026-11-17T15:00:00Z"))).toBe("2026-11-17"); // 紐約 10:00
  });
  it("夏令時間也正確", () => {
    expect(toUsSessionDate(new Date("2026-07-14T22:00:00Z"))).toBe("2026-07-14"); // 紐約 18:00 EDT
  });
});

describe("computeScreenHistory", () => {
  it("沒有資料時回傳空結果", () => {
    expect(computeScreenHistory([]).sessionDate).toBeNull();
  });

  it("只有一個交易日時不產生新進/剔除，連續天數為 1", () => {
    const result = computeScreenHistory([snap(cronAt("2026-11-18"), ["AAA", "BBB"])]);
    expect(result.previousSessionDate).toBeNull();
    expect(result.newTickers).toEqual([]);
    expect(result.dropped).toEqual([]);
    expect(result.streaks).toEqual({ AAA: 1, BBB: 1 });
  });

  it("計算新進、剔除與連續天數", () => {
    const result = computeScreenHistory([
      snap(cronAt("2026-11-18"), ["AAA", "CCC", "DDD"]),
      snap(cronAt("2026-11-17"), ["AAA", "BBB", "CCC"]),
      snap(cronAt("2026-11-14"), ["AAA", "BBB"]),
    ]);
    expect(result.sessionDate).toBe("2026-11-17");
    expect(result.previousSessionDate).toBe("2026-11-16");
    expect(result.newTickers).toEqual(["DDD"]);
    expect(result.dropped).toEqual([{ ticker: "BBB", company: "BBB Inc" }]);
    expect(result.streaks).toEqual({ AAA: 3, CCC: 2, DDD: 1 });
    expect(result.sessionsAvailable).toBe(3);
  });

  it("週末重複快照與同日手動同步不會重複計算", () => {
    const result = computeScreenHistory([
      snap(cronAt("2026-11-17"), ["AAA", "NEW"]), // 週二早上 → 週一
      snap(cronAt("2026-11-16"), ["AAA"]), // 週一早上 → 週五（重複）
      snap(cronAt("2026-11-15"), ["AAA"]), // 週日早上 → 週五（重複）
      snap(new Date("2026-11-14T03:00:00+08:00"), ["AAA", "OLD"]), // 週五盤中手動 → 被同日較新的取代
      snap(cronAt("2026-11-14"), ["AAA"]), // 週六早上 → 週五
    ]);
    expect(result.previousSessionDate).toBe("2026-11-13");
    expect(result.newTickers).toEqual(["NEW"]);
    expect(result.dropped).toEqual([]);
    expect(result.streaks.AAA).toBe(2);
  });

  it("中斷過的股票只算最近一段連續", () => {
    const result = computeScreenHistory([
      snap(cronAt("2026-11-19"), ["AAA"]),
      snap(cronAt("2026-11-18"), []),
      snap(cronAt("2026-11-17"), ["AAA"]),
    ]);
    expect(result.streaks.AAA).toBe(1);
    expect(result.newTickers).toEqual(["AAA"]);
  });
});

describe("buildDailyDigest", () => {
  const history = computeScreenHistory([
    snap(cronAt("2026-11-18"), ["AAA", "CCC", "DDD"]),
    snap(cronAt("2026-11-17"), ["AAA", "BBB", "CCC"]),
    snap(cronAt("2026-11-14"), ["AAA", "BBB"]),
  ]);

  it("列出新進、剔除、連續上榜與網址", () => {
    const text = buildDailyDigest({ qualityMomentum: history }, "https://example.com/")!;
    expect(text).toContain("美股交易日 2026-11-17");
    expect(text).toContain("【中大型股獲利動能】3 檔");
    expect(text).toContain("新進 1：DDD");
    expect(text).toContain("剔除 1：BBB");
    expect(text).toContain("連續上榜：AAA 3+ 天");
    expect(text).toContain("🔗 https://example.com/");
  });

  it("所有視角都沒有變化時不推播", () => {
    const flat = computeScreenHistory([snap(cronAt("2026-11-18"), ["AAA"]), snap(cronAt("2026-11-17"), ["AAA"])]);
    expect(buildDailyDigest({ qualityMomentum: flat }, undefined)).toBeNull();
  });

  it("長名單會截斷", () => {
    const many = Array.from({ length: 12 }, (_, i) => `T${String.fromCharCode(65 + i)}`);
    const wide = computeScreenHistory([snap(cronAt("2026-11-18"), many), snap(cronAt("2026-11-17"), [])]);
    expect(buildDailyDigest({ topGainers: wide }, undefined)).toContain("…等 12 檔");
  });
});

describe("splitMessage", () => {
  it("依段落切割且每段不超過上限", () => {
    const chunks = splitMessage(["a".repeat(50), "b".repeat(50), "c".repeat(50)].join("\n\n"), 110);
    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.length <= 110)).toBe(true);
  });
});
