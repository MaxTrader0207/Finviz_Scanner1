import { describe, expect, it } from "vitest";
import { buildMiniCandleGeometry, getMiniCandlePoints, MINI_CANDLE_POINT_LIMIT, type MiniCandlePoint } from "./miniCandleChart";

const points: MiniCandlePoint[] = [
  { timestamp: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { timestamp: 2, open: 11, high: 13, low: 10, close: 10.5, volume: 250 },
  { timestamp: 3, open: 10.5, high: 14, low: 10, close: 13, volume: 500 },
  { timestamp: 4, open: 13, high: 13.5, low: 11, close: 12, volume: 125 },
];

describe("getMiniCandlePoints", () => {
  it("keeps the newest 30 trading points for card charts", () => {
    const manyPoints = Array.from({ length: 35 }, (_, index) => ({ ...points[0], timestamp: index + 1, close: index + 10 }));
    const sliced = getMiniCandlePoints(manyPoints);

    expect(sliced).toHaveLength(MINI_CANDLE_POINT_LIMIT);
    expect(sliced[0].timestamp).toBe(6);
    expect(sliced.at(-1)?.timestamp).toBe(35);
  });
});

describe("buildMiniCandleGeometry", () => {
  it("calculates the latest range high and low from OHLC values", () => {
    const chart = buildMiniCandleGeometry(points);

    expect(chart.chartHigh).toBe(14);
    expect(chart.chartLow).toBe(9);
    expect(chart.maxVolume).toBe(500);
    expect(chart.candles).toHaveLength(4);
  });

  it("preserves candle direction and scales the largest volume to the bottom of the volume area", () => {
    const chart = buildMiniCandleGeometry(points);

    expect(chart.candles.map((candle) => candle.isUp)).toEqual([true, false, true, false]);
    expect(chart.candles[2].volumeY).toBe(chart.volumeTop);
    expect(chart.candles[2].volumeHeight).toBe(chart.volumeBottom - chart.volumeTop);
    expect(chart.candles.every((candle) => candle.bodyHeight >= 1.3)).toBe(true);
  });
});
