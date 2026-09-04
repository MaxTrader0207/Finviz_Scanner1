import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { withEdgeCache } from "../cache";

const PRICE_CACHE_TTL_SECONDS = 15 * 60;
const YAHOO_CHART_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";

export const priceHistoryInput = z.object({
  ticker: z.string().regex(/^[A-Z.]{1,10}$/),
  range: z.enum(["3mo", "6mo"]).default("3mo"),
});

export const priceHistoryBatchInput = z
  .object({
    tickers: z.array(z.string().regex(/^[A-Z.]{1,10}$/)).min(1).max(25),
    forceRefresh: z.boolean().default(false),
  })
  .superRefine(({ tickers }, context) => {
    if (new Set(tickers).size !== tickers.length) context.addIssue({ code: "custom", message: "Tickers must be unique" });
  });

export type PricePoint = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };
export type PriceHistory = {
  ticker: string;
  points: PricePoint[];
  fetchedAt: number;
  sourceName: string;
  sourceUrl: string;
  rangeLabel: string;
};

type PriceRange = "3mo" | "6mo";

const rangeSettings: Record<PriceRange, { maxPoints: number; label: string }> = {
  "3mo": { maxPoints: 30, label: "近 30 個交易日日線（OHLCV）" },
  "6mo": { maxPoints: 132, label: "近 6 個月日線（OHLCV）" },
};

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      meta?: { symbol?: string };
      timestamp?: number[];
      indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }> };
    }>;
  };
};

export function parseYahooChart(ticker: string, payload: YahooChartPayload, range: PriceRange = "3mo"): PriceHistory {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const opens = quote?.open ?? [];
  const highs = quote?.high ?? [];
  const lows = quote?.low ?? [];
  const closes = quote?.close ?? [];
  const volumes = quote?.volume ?? [];
  const points = timestamps
    .map((timestamp, index) => ({ timestamp, open: opens[index], high: highs[index], low: lows[index], close: closes[index], volume: volumes[index] }))
    .filter((point): point is PricePoint => Number.isFinite(point.timestamp) && typeof point.open === "number" && Number.isFinite(point.open) && typeof point.high === "number" && Number.isFinite(point.high) && typeof point.low === "number" && Number.isFinite(point.low) && typeof point.close === "number" && Number.isFinite(point.close) && typeof point.volume === "number" && Number.isFinite(point.volume) && point.volume >= 0)
    .slice(-rangeSettings[range].maxPoints);

  if (points.length < 2) throw new Error("Insufficient recent daily OHLCV points");

  return {
    ticker: result?.meta?.symbol?.toUpperCase() || ticker,
    points,
    fetchedAt: Date.now(),
    sourceName: "Yahoo Finance",
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/history/`,
    rangeLabel: rangeSettings[range].label,
  };
}

async function getPriceHistory(ticker: string, range: PriceRange = "3mo", forceRefresh = false): Promise<PriceHistory> {
  return withEdgeCache({
    cacheKey: `price:${ticker}:${range}`,
    ttlSeconds: PRICE_CACHE_TTL_SECONDS,
    forceRefresh,
    compute: async () => {
      const response = await fetch(`${YAHOO_CHART_ENDPOINT}/${encodeURIComponent(ticker)}?range=${range}&interval=1d`, {
        headers: { "User-Agent": "SignalLedger/1.0 research dashboard" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Price source returned ${response.status}`);
      return parseYahooChart(ticker, (await response.json()) as YahooChartPayload, range);
    },
  });
}

async function getPriceHistoryBatch(tickers: string[], forceRefresh = false) {
  const settled = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        return { ticker, history: await getPriceHistory(ticker, "3mo", forceRefresh) };
      } catch (error) {
        console.warn(`[Price History] Unable to retrieve ${ticker} in mini chart batch:`, error);
        return { ticker, history: null };
      }
    })
  );
  return {
    histories: Object.fromEntries(settled.filter((item): item is { ticker: string; history: PriceHistory } => item.history !== null).map(({ ticker, history }) => [ticker, history])),
    unavailable: settled.filter((item) => item.history === null).map((item) => item.ticker),
  };
}

export const priceHistoryRouter = router({
  get: publicProcedure.input(priceHistoryInput).query(async ({ input }) => {
    try {
      return await getPriceHistory(input.ticker, input.range);
    } catch (error) {
      console.warn(`[Price History] Unable to retrieve ${input.ticker}:`, error);
      throw new TRPCError({ code: "BAD_GATEWAY", message: "近期價格資料暫時無法取得，請稍後再試。" });
    }
  }),
  list: publicProcedure.input(priceHistoryBatchInput).query(async ({ input }) => getPriceHistoryBatch(input.tickers, input.forceRefresh)),
});
