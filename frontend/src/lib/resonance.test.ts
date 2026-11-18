import { describe, expect, it } from "vitest";
import { computeResonance, isStale } from "./resonance";
import type { Screen, Stock } from "./screenerData";

const stock = (ticker: string): Stock => ({ ticker, company: `${ticker} Inc`, sector: "Tech", industry: "x", country: "USA", marketCapLabel: "1B", marketCapBn: 1, pe: "-", price: 10, change: 1, volume: 100 });
const screen = (key: string, tickers: string[]) => ({ key, name: key, shortName: key.toUpperCase(), stocks: tickers.map(stock) }) as unknown as Screen;
const tx = (ticker: string, value: number) => ({ ticker, owner: "o", relationship: "CEO", date: "Nov 17", transaction: "Buy" as const, cost: 1, shares: 1, value });

describe("computeResonance", () => {
  const screens = [screen("qualityMomentum", ["AAA", "BBB"]), screen("newHighMomentum", ["AAA", "CCC"]), screen("topLosers", ["BBB"]), screen("insiderTrading", ["AAA"])];
  const histories = { qualityMomentum: { sessionDate: "x", previousSessionDate: "y", newTickers: ["AAA"], dropped: [], streaks: { AAA: 1, BBB: 4 }, sessionsAvailable: 5 } };

  it("找出 2 個以上視角的交集並排序", () => {
    const rows = computeResonance(screens, histories, null);
    expect(rows.map((row) => row.ticker)).toEqual(["BBB", "AAA"]); // 同分時連續天數多的優先
    expect(rows.find((row) => row.ticker === "AAA")!.hits[0]).toMatchObject({ isNew: true, streak: 1 });
  });

  it("偏多 + 偏空標示分歧", () => {
    const rows = computeResonance(screens, histories, null);
    expect(rows.find((row) => row.ticker === "BBB")!.hasConflict).toBe(true);
    expect(rows.find((row) => row.ticker === "AAA")!.hasConflict).toBe(false);
  });

  it("內部人買進算一個訊號", () => {
    const rows = computeResonance(screens, histories, { buy: [tx("CCC", 500), tx("CCC", 300)], sale: [] });
    const ccc = rows.find((row) => row.ticker === "CCC")!;
    expect(ccc.score).toBe(2);
    expect(ccc.insiderBuy).toEqual({ count: 2, value: 800 });
  });
});

describe("isStale", () => {
  it("超過 26 小時算過期", () => {
    const now = Date.UTC(2026, 10, 19, 2);
    expect(isStale(now - 25 * 3600_000, now)).toBe(false);
    expect(isStale(now - 27 * 3600_000, now)).toBe(true);
    expect(isStale(null, now)).toBe(true);
  });
});
