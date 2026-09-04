import { describe, expect, it } from "vitest";
import { calculateExponentialMovingAverage, calculateMacd, calculateRsi, calculateSimpleMovingAverage, findLatestRsiExtremeEntry, getAllMovingAveragePeriods, getRsiZone, getVisibleMovingAveragePeriods, MOVING_AVERAGE_PRESENTATIONS, parseVisibleMovingAveragePeriods, RSI_REFERENCE_BANDS, summarizeLatestMovingAverage } from "./movingAverage";

describe("calculateSimpleMovingAverage", () => {
  it("keeps the first 29 values empty and calculates MA30 from closing prices", () => {
    const values = Array.from({ length: 31 }, (_, index) => index + 1);
    const result = calculateSimpleMovingAverage(values, 30);

    expect(result.slice(0, 29)).toEqual(Array(29).fill(null));
    expect(result[29]).toBe(15.5);
    expect(result[30]).toBe(16.5);
  });

  it("keeps independent warm-up periods for MA10, MA60 and MA100", () => {
    const values = Array.from({ length: 100 }, (_, index) => index + 1);
    const ma10 = calculateSimpleMovingAverage(values, 10);
    const ma60 = calculateSimpleMovingAverage(values, 60);
    const ma100 = calculateSimpleMovingAverage(values, 100);

    expect(ma10.slice(0, 9)).toEqual(Array(9).fill(null));
    expect(ma10[9]).toBe(5.5);
    expect(ma60.slice(0, 59)).toEqual(Array(59).fill(null));
    expect(ma60[59]).toBe(30.5);
    expect(ma100.slice(0, 99)).toEqual(Array(99).fill(null));
    expect(ma100[99]).toBe(50.5);
  });

  it("keeps each displayed moving average paired with its chart color", () => {
    expect(MOVING_AVERAGE_PRESENTATIONS).toEqual([
      { period: 10, label: "MA10", color: "#d9593d" },
      { period: 30, label: "MA30", color: "#7c3aed" },
      { period: 60, label: "MA60", color: "#b7791f" },
      { period: 100, label: "MA100", color: "#1f6d9c" },
    ]);
  });

  it("normalizes independently selected moving averages in chart order", () => {
    expect(getVisibleMovingAveragePeriods([10, 60])).toEqual([10, 60]);
    expect(getVisibleMovingAveragePeriods([100, 10, 10])).toEqual([10, 100]);
    expect(getVisibleMovingAveragePeriods([])).toEqual([]);
  });

  it("restores valid stored visibility while safely defaulting invalid storage values", () => {
    expect(getAllMovingAveragePeriods()).toEqual([10, 30, 60, 100]);
    expect(parseVisibleMovingAveragePeriods("[100,10,10]")).toEqual([10, 100]);
    expect(parseVisibleMovingAveragePeriods("[]")).toEqual([]);
    expect(parseVisibleMovingAveragePeriods("not-json")).toEqual([10, 30, 60, 100]);
    expect(parseVisibleMovingAveragePeriods("[10,\"30\"]")).toEqual([10, 30, 60, 100]);
  });

  it("rejects invalid periods and non-finite source values", () => {
    expect(() => calculateSimpleMovingAverage([1, 2], 0)).toThrow(RangeError);
    expect(() => calculateSimpleMovingAverage([1, Number.NaN], 2)).toThrow(RangeError);
  });

  it("summarizes the current MA value and one-day slope from populated MA values", () => {
    expect(summarizeLatestMovingAverage([null, 10, 10.5])).toEqual({
      current: 10.5,
      previous: 10,
      change: 0.5,
      changePercent: 5,
      direction: "up",
    });
    expect(summarizeLatestMovingAverage([null, 10])).toMatchObject({ current: 10, direction: "unavailable" });
  });

  it("seeds EMA and MACD from the required lookback windows", () => {
    expect(calculateExponentialMovingAverage([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
    const macd = calculateMacd(Array(40).fill(100));
    expect(macd[24]).toEqual({ macd: null, signal: null, histogram: null });
    expect(macd[33]).toEqual({ macd: 0, signal: 0, histogram: 0 });
  });

  it("calculates RSI(6) with Wilder smoothing and handles one-way moves", () => {
    expect(calculateRsi([1, 2, 3, 4, 5, 6, 7], 6)).toEqual([null, null, null, null, null, null, 100]);
    expect(calculateRsi([7, 6, 5, 4, 3, 2, 1], 6)).toEqual([null, null, null, null, null, null, 0]);
  });

  it("classifies current RSI values using the requested 80 and 20 alert thresholds", () => {
    expect(RSI_REFERENCE_BANDS).toEqual({ upper: 80, lower: 20 });
    expect(getRsiZone(80)).toBe("neutral");
    expect(getRsiZone(80.01)).toBe("overbought");
    expect(getRsiZone(20)).toBe("neutral");
    expect(getRsiZone(19.99)).toBe("oversold");
    expect(getRsiZone(null)).toBe("unavailable");
  });

  it("finds the most recent first entry into an RSI extreme zone", () => {
    expect(findLatestRsiExtremeEntry([null, 72, 81, 84, 76, 19, 15, 24])).toEqual({ index: 5, value: 19, zone: "oversold" });
    expect(findLatestRsiExtremeEntry([null, 76, 81, 85])).toEqual({ index: 2, value: 81, zone: "overbought" });
    expect(findLatestRsiExtremeEntry([null, 20, 35, 80])).toBeNull();
  });
});
