export function calculateSimpleMovingAverage(values: number[], period: number): Array<number | null> {
  if (!Number.isInteger(period) || period < 1) throw new RangeError("MA period must be a positive integer");
  if (!values.every(Number.isFinite)) throw new RangeError("MA values must be finite numbers");

  let runningTotal = 0;
  return values.map((value, index) => {
    runningTotal += value;
    if (index >= period) runningTotal -= values[index - period];
    return index < period - 1 ? null : runningTotal / period;
  });
}

export const MOVING_AVERAGE_PRESENTATIONS = [
  { period: 10, label: "MA10", color: "#d9593d" },
  { period: 30, label: "MA30", color: "#7c3aed" },
  { period: 60, label: "MA60", color: "#b7791f" },
  { period: 100, label: "MA100", color: "#1f6d9c" },
] as const;

export type MovingAveragePeriod = (typeof MOVING_AVERAGE_PRESENTATIONS)[number]["period"];
export const MOVING_AVERAGE_VISIBILITY_STORAGE_KEY = "signal-ledger-visible-moving-averages";

export function getVisibleMovingAveragePeriods(periods: Iterable<number>): MovingAveragePeriod[] {
  const selected = new Set(periods);
  return MOVING_AVERAGE_PRESENTATIONS.filter(({ period }) => selected.has(period)).map(({ period }) => period);
}

export function getAllMovingAveragePeriods(): MovingAveragePeriod[] {
  return MOVING_AVERAGE_PRESENTATIONS.map(({ period }) => period);
}

export function parseVisibleMovingAveragePeriods(serialized: string | null): MovingAveragePeriod[] {
  if (serialized === null) return getAllMovingAveragePeriods();
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed) || !parsed.every((period) => typeof period === "number")) return getAllMovingAveragePeriods();
    return getVisibleMovingAveragePeriods(parsed);
  } catch {
    return getAllMovingAveragePeriods();
  }
}

export type MovingAverageSummary = {
  current: number | null;
  previous: number | null;
  change: number | null;
  changePercent: number | null;
  direction: "up" | "down" | "flat" | "unavailable";
};

export function summarizeLatestMovingAverage(averages: Array<number | null>): MovingAverageSummary {
  const populated = averages.filter((value): value is number => value !== null);
  const current = populated.at(-1) ?? null;
  const previous = populated.at(-2) ?? null;
  if (current === null || previous === null || previous === 0) {
    return { current, previous, change: null, changePercent: null, direction: "unavailable" };
  }

  const change = current - previous;
  const changePercent = (change / previous) * 100;
  return {
    current,
    previous,
    change,
    changePercent,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

function assertFiniteSeries(values: number[]) {
  if (!values.every(Number.isFinite)) throw new RangeError("Indicator values must be finite numbers");
}

export function calculateExponentialMovingAverage(values: number[], period: number): Array<number | null> {
  if (!Number.isInteger(period) || period < 1) throw new RangeError("EMA period must be a positive integer");
  assertFiniteSeries(values);
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return result;

  const multiplier = 2 / (period + 1);
  let previous = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = previous;
  for (let index = period; index < values.length; index += 1) {
    previous = (values[index] - previous) * multiplier + previous;
    result[index] = previous;
  }
  return result;
}

export type MacdPoint = { macd: number | null; signal: number | null; histogram: number | null };

export function calculateMacd(values: number[], shortPeriod = 12, longPeriod = 26, signalPeriod = 9): MacdPoint[] {
  if (shortPeriod >= longPeriod) throw new RangeError("MACD short period must be less than long period");
  const shortEma = calculateExponentialMovingAverage(values, shortPeriod);
  const longEma = calculateExponentialMovingAverage(values, longPeriod);
  const macd = values.map((_, index) => shortEma[index] === null || longEma[index] === null ? null : shortEma[index]! - longEma[index]!);
  const firstMacdIndex = macd.findIndex((value) => value !== null);
  if (firstMacdIndex < 0) return values.map(() => ({ macd: null, signal: null, histogram: null }));

  const validMacd = macd.slice(firstMacdIndex) as number[];
  const compactSignal = calculateExponentialMovingAverage(validMacd, signalPeriod);
  return macd.map((macdValue, index) => {
    const signal = index < firstMacdIndex ? null : compactSignal[index - firstMacdIndex];
    return { macd: macdValue, signal, histogram: macdValue === null || signal === null ? null : macdValue - signal };
  });
}

export function calculateRsi(values: number[], period = 6): Array<number | null> {
  if (!Number.isInteger(period) || period < 1) throw new RangeError("RSI period must be a positive integer");
  assertFiniteSeries(values);
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length <= period) return result;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const difference = values[index] - values[index - 1];
    gains += Math.max(difference, 0);
    losses += Math.max(-difference, 0);
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  const rsiFromAverages = () => averageLoss === 0 ? (averageGain === 0 ? 50 : 100) : 100 - 100 / (1 + averageGain / averageLoss);
  result[period] = rsiFromAverages();

  for (let index = period + 1; index < values.length; index += 1) {
    const difference = values[index] - values[index - 1];
    averageGain = ((averageGain * (period - 1)) + Math.max(difference, 0)) / period;
    averageLoss = ((averageLoss * (period - 1)) + Math.max(-difference, 0)) / period;
    result[index] = rsiFromAverages();
  }
  return result;
}

export type RsiZone = "overbought" | "oversold" | "neutral" | "unavailable";
export const RSI_REFERENCE_BANDS = { upper: 80, lower: 20 } as const;

export function getRsiZone(value: number | null): RsiZone {
  if (value === null || !Number.isFinite(value)) return "unavailable";
  if (value > RSI_REFERENCE_BANDS.upper) return "overbought";
  if (value < RSI_REFERENCE_BANDS.lower) return "oversold";
  return "neutral";
}

export type RsiExtremeEntry = { index: number; value: number; zone: "overbought" | "oversold" };

export function findLatestRsiExtremeEntry(values: Array<number | null>): RsiExtremeEntry | null {
  let latest: RsiExtremeEntry | null = null;
  let previousZone: RsiZone = "unavailable";

  values.forEach((value, index) => {
    const zone = getRsiZone(value);
    if ((zone === "overbought" || zone === "oversold") && zone !== previousZone && value !== null) {
      latest = { index, value, zone };
    }
    previousZone = zone;
  });

  return latest;
}
