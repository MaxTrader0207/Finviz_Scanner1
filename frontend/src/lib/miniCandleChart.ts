export const MINI_CANDLE_POINT_LIMIT = 30;

export type MiniCandlePoint = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MiniCandleChartDimensions = {
  width: number;
  height: number;
  priceTop: number;
  priceBottom: number;
  volumeTop: number;
  volumeBottom: number;
};

export type MiniCandleGeometry = {
  width: number;
  height: number;
  priceTop: number;
  priceBottom: number;
  volumeTop: number;
  volumeBottom: number;
  bodyWidth: number;
  chartHigh: number;
  chartLow: number;
  maxVolume: number;
  candles: Array<{
    timestamp: number;
    x: number;
    wickTop: number;
    wickBottom: number;
    bodyTop: number;
    bodyHeight: number;
    volumeY: number;
    volumeHeight: number;
    isUp: boolean;
  }>;
};

export function getMiniCandlePoints(points: readonly MiniCandlePoint[], limit = MINI_CANDLE_POINT_LIMIT): MiniCandlePoint[] {
  return points.slice(-Math.max(0, limit));
}

const DEFAULT_DIMENSIONS: MiniCandleChartDimensions = {
  width: 128,
  height: 58,
  priceTop: 6,
  priceBottom: 40,
  volumeTop: 44,
  volumeBottom: 58,
};

export function buildMiniCandleGeometry(
  points: readonly MiniCandlePoint[],
  dimensions: MiniCandleChartDimensions = DEFAULT_DIMENSIONS,
): MiniCandleGeometry {
  const highPoint = points.reduce((highest, point) => (point.high > highest.high ? point : highest), points[0]);
  const lowPoint = points.reduce((lowest, point) => (point.low < lowest.low ? point : lowest), points[0]);
  const chartHigh = highPoint?.high ?? 0;
  const chartLow = lowPoint?.low ?? 0;
  const chartRange = Math.max(chartHigh - chartLow, Math.abs(chartHigh) * 0.01, 0.01);
  const xStep = points.length ? dimensions.width / points.length : dimensions.width;
  const bodyWidth = Math.max(1.8, Math.min(6, xStep * 0.6));
  const y = (value: number) => dimensions.priceTop + ((chartHigh - value) / chartRange) * (dimensions.priceBottom - dimensions.priceTop);
  const maxVolume = Math.max(...points.map((point) => point.volume), 1);
  const volumeY = (value: number) => dimensions.volumeBottom - (value / maxVolume) * (dimensions.volumeBottom - dimensions.volumeTop);

  return {
    ...dimensions,
    bodyWidth,
    chartHigh,
    chartLow,
    maxVolume,
    candles: points.map((point, index) => {
      const openY = y(point.open);
      const closeY = y(point.close);
      const volumeTop = volumeY(point.volume);
      return {
        timestamp: point.timestamp,
        x: (index + 0.5) * xStep,
        wickTop: y(point.high),
        wickBottom: y(point.low),
        bodyTop: Math.min(openY, closeY),
        bodyHeight: Math.max(1.3, Math.abs(openY - closeY)),
        volumeY: volumeTop,
        volumeHeight: Math.max(1, dimensions.volumeBottom - volumeTop),
        isUp: point.close >= point.open,
      };
    }),
  };
}
