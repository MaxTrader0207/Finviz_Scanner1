import { asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { finvizScreenSnapshots, screenEntries } from "../db/schema";
import { withEdgeCache } from "../cache";
import { collapseToSessions, parseStocks, type Session } from "./screenHistory";
import { SCREEN_SOURCES } from "./screenSources";

/**
 * 篩選績效追蹤。
 *
 * 進場事件：某檔股票在美股交易日 S 出現在某視角、但前一個有快照的交易日不在 → 記一筆 entry。
 * 報酬：以 S 當日收盤為基準，算第 1／5／20 個交易日後的收盤報酬，同期 SPY 當對照。
 * 這是「名單公布當天收盤買進」的理想化假設（cron 在收盤後才抓到名單），實際能拿到的
 * 通常是隔天開盤價，所以數字會略為樂觀，前端會註明。
 */

export const HORIZONS = [1, 5, 20] as const;
export type Horizon = (typeof HORIZONS)[number];

/** 每個里程碑最早什麼時候值得去查（日曆天）：避免每天把所有未完成的 entry 都重抓一次。 */
const MILESTONE_CALENDAR_DAYS: Record<Horizon, number> = { 1: 1, 5: 7, 20: 28 };
/** 超過這麼多日曆天還補不到 20 日報酬（下市、改代碼、Yahoo 查無），就放棄追蹤。 */
const GIVE_UP_CALENDAR_DAYS = 45;
/** 每次執行最多查幾檔股票的日線（Workers 子請求上限與 Yahoo 節流的保守值）。 */
export const MAX_TICKERS_PER_RUN = 400;
const INSERT_CHUNK = 20; // D1 每個查詢最多 100 個綁定參數，每列 4 個欄位
const YAHOO_CHART_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";
const DAY_MS = 24 * 60 * 60 * 1000;

export type EntryCandidate = { screenKey: string; ticker: string; sessionDate: string; snapshotPrice: number | null };

/** 純函式：從「新到舊」的交易日推導新進事件（最舊的那天沒有比較基準，不算）。 */
export function deriveEntries(screenKey: string, sessionsNewestFirst: Session[]): EntryCandidate[] {
  const entries: EntryCandidate[] = [];
  for (let i = 0; i < sessionsNewestFirst.length - 1; i += 1) {
    const current = sessionsNewestFirst[i]!;
    const previous = sessionsNewestFirst[i + 1]!;
    for (const stock of current.stocks) {
      if (previous.tickers.has(stock.ticker)) continue;
      entries.push({ screenKey, ticker: stock.ticker, sessionDate: current.date, snapshotPrice: stock.price ?? null });
    }
  }
  return entries;
}

export type DailyBar = { date: string; close: number };

export type ForwardReturns = { entryClose: number | null; returns: Record<Horizon, number | null> };

/** 純函式：以 sessionDate（或之前最近一根）收盤為基準，算第 N 根 K 棒後的報酬。 */
export function computeForwardReturns(bars: DailyBar[], sessionDate: string): ForwardReturns {
  let baseIndex = -1;
  for (let i = 0; i < bars.length; i += 1) {
    if (bars[i]!.date <= sessionDate) baseIndex = i;
    else break;
  }
  const empty = { 1: null, 5: null, 20: null } as Record<Horizon, number | null>;
  if (baseIndex < 0) return { entryClose: null, returns: empty };
  const base = bars[baseIndex]!.close;
  const returns = { ...empty };
  for (const horizon of HORIZONS) {
    const target = bars[baseIndex + horizon];
    returns[horizon] = target && base > 0 ? target.close / base - 1 : null;
  }
  return { entryClose: base, returns };
}

export function calendarDaysSince(sessionDate: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(`${sessionDate}T00:00:00Z`)) / DAY_MS);
}

type PendingRow = { id: number; ticker: string; sessionDate: string; ret1d: number | null; ret5d: number | null; ret20d: number | null };

/** 純函式：這筆 entry 今天是否有到期的里程碑需要去查價。 */
export function isDue(row: Pick<PendingRow, "sessionDate" | "ret1d" | "ret5d" | "ret20d">, now: Date): boolean {
  const days = calendarDaysSince(row.sessionDate, now);
  if (days > GIVE_UP_CALENDAR_DAYS) return true; // 讓它被標記成放棄
  return (row.ret1d === null && days >= MILESTONE_CALENDAR_DAYS[1]) || (row.ret5d === null && days >= MILESTONE_CALENDAR_DAYS[5]) || (row.ret20d === null && days >= MILESTONE_CALENDAR_DAYS[20]);
}

const NY_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });

export function parseYahooDailyCloses(payload: unknown): DailyBar[] {
  const result = (payload as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> } })?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const bars: DailyBar[] = [];
  timestamps.forEach((timestamp, index) => {
    const close = closes[index];
    if (typeof close === "number" && Number.isFinite(close) && close > 0) bars.push({ date: NY_DATE.format(new Date(timestamp * 1000)), close });
  });
  return bars;
}

async function fetchDailyCloses(ticker: string, fromDate: string): Promise<DailyBar[]> {
  const period1 = Math.floor((Date.parse(`${fromDate}T00:00:00Z`) - 7 * DAY_MS) / 1000);
  const period2 = Math.floor(Date.now() / 1000) + 86_400;
  const response = await fetch(`${YAHOO_CHART_ENDPOINT}/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`, {
    headers: { "User-Agent": "SignalLedger/1.0 research dashboard" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Yahoo ${response.status}`);
  return parseYahooDailyCloses(await response.json());
}

/** 從快照推導新進事件並寫入（已存在的會被略過）。lookbackRows 不給就讀全部歷史（回補用）。 */
export async function recordEntries(db: Db, lookbackRows?: number): Promise<number> {
  let inserted = 0;
  for (const source of SCREEN_SOURCES) {
    const query = db
      .select({ fetchedAt: finvizScreenSnapshots.fetchedAt, stocks: finvizScreenSnapshots.stocks })
      .from(finvizScreenSnapshots)
      .where(eq(finvizScreenSnapshots.screenKey, source.key))
      .orderBy(desc(finvizScreenSnapshots.fetchedAt));
    const rows = lookbackRows ? await query.limit(lookbackRows) : await query;
    const sessions = collapseToSessions(rows.map((row) => ({ fetchedAt: row.fetchedAt, stocks: parseStocks(row.stocks) })));
    const candidates = deriveEntries(source.key, sessions);
    for (let i = 0; i < candidates.length; i += INSERT_CHUNK) {
      const chunk = candidates.slice(i, i + INSERT_CHUNK);
      const result = await db.insert(screenEntries).values(chunk).onConflictDoNothing().returning({ id: screenEntries.id });
      inserted += result.length;
    }
  }
  return inserted;
}

export type UpdateReturnsResult = { tickersFetched: number; entriesUpdated: number; entriesCompleted: number; failedTickers: string[]; remainingDueTickers: number };

/** 補齊到期的報酬。每次最多查 MAX_TICKERS_PER_RUN 檔，剩下的下次（或再呼叫一次回補）再補。 */
export async function updateReturns(db: Db, now = new Date()): Promise<UpdateReturnsResult> {
  const pending = await db
    .select({ id: screenEntries.id, ticker: screenEntries.ticker, sessionDate: screenEntries.sessionDate, ret1d: screenEntries.ret1d, ret5d: screenEntries.ret5d, ret20d: screenEntries.ret20d })
    .from(screenEntries)
    .where(eq(screenEntries.completed, false))
    .orderBy(asc(screenEntries.sessionDate));

  const due = pending.filter((row) => isDue(row, now));
  const byTicker = new Map<string, PendingRow[]>();
  for (const row of due) byTicker.set(row.ticker, [...(byTicker.get(row.ticker) ?? []), row]);
  const tickers = [...byTicker.keys()].slice(0, MAX_TICKERS_PER_RUN);
  if (!tickers.length) return { tickersFetched: 0, entriesUpdated: 0, entriesCompleted: 0, failedTickers: [], remainingDueTickers: 0 };

  const earliest = tickers.map((ticker) => byTicker.get(ticker)![0]!.sessionDate).sort()[0]!;
  const spyBars = await fetchDailyCloses("SPY", earliest);

  const failedTickers: string[] = [];
  const updates: Array<ReturnType<typeof buildUpdate>> = [];
  let entriesCompleted = 0;

  function buildUpdate(row: PendingRow, bars: DailyBar[] | null) {
    const stock = bars ? computeForwardReturns(bars, row.sessionDate) : null;
    const spy = computeForwardReturns(spyBars, row.sessionDate);
    const ret1d = stock?.returns[1] ?? row.ret1d;
    const ret5d = stock?.returns[5] ?? row.ret5d;
    const ret20d = stock?.returns[20] ?? row.ret20d;
    const completed = ret20d !== null || calendarDaysSince(row.sessionDate, now) > GIVE_UP_CALENDAR_DAYS;
    if (completed) entriesCompleted += 1;
    return db
      .update(screenEntries)
      .set({
        ...(stock?.entryClose ? { entryClose: stock.entryClose } : {}),
        ret1d,
        ret5d,
        ret20d,
        spy1d: spy.returns[1],
        spy5d: spy.returns[5],
        spy20d: spy.returns[20],
        completed,
        updatedAt: now,
      })
      .where(eq(screenEntries.id, row.id));
  }

  // 一次 6 檔並行，對 Yahoo 比較客氣。
  for (let i = 0; i < tickers.length; i += 6) {
    await Promise.all(
      tickers.slice(i, i + 6).map(async (ticker) => {
        let bars: DailyBar[] | null = null;
        try {
          bars = await fetchDailyCloses(ticker, byTicker.get(ticker)![0]!.sessionDate);
        } catch (error) {
          console.warn(`[Performance] ${ticker}:`, error);
          failedTickers.push(ticker);
        }
        for (const row of byTicker.get(ticker)!) updates.push(buildUpdate(row, bars));
      })
    );
  }

  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    if (batch.length) await db.batch(batch as [typeof batch[number], ...typeof batch]);
  }

  return { tickersFetched: tickers.length, entriesUpdated: updates.length, entriesCompleted, failedTickers, remainingDueTickers: Math.max(byTicker.size - tickers.length, 0) };
}

export type HorizonStats = { count: number; mean: number | null; median: number | null; winRate: number | null; excessMean: number | null };
export type ScreenPerformance = {
  screenKey: string;
  screenName: string;
  entryCount: number;
  firstSessionDate: string | null;
  horizons: Record<`d${Horizon}`, HorizonStats>;
  recentEntries: Array<{ ticker: string; sessionDate: string; entryClose: number | null; ret1d: number | null; ret5d: number | null; ret20d: number | null }>;
};

type StatRow = { ret: number | null; spy: number | null };

/** 純函式：一組報酬的平均、中位數、勝率、相對 SPY 的平均超額報酬。 */
export function summarize(rows: StatRow[]): HorizonStats {
  const values = rows.map((row) => row.ret).filter((value): value is number => value !== null);
  if (!values.length) return { count: 0, mean: null, median: null, winRate: null, excessMean: null };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  const excess = rows.filter((row) => row.ret !== null && row.spy !== null).map((row) => row.ret! - row.spy!);
  return {
    count: values.length,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    median,
    winRate: values.filter((value) => value > 0).length / values.length,
    excessMean: excess.length ? excess.reduce((sum, value) => sum + value, 0) / excess.length : null,
  };
}

export async function getPerformanceSummary(db: Db): Promise<{ screens: ScreenPerformance[]; trackingSince: string | null }> {
  return withEdgeCache({
    cacheKey: "performance-summary:v1",
    ttlSeconds: 10 * 60,
    compute: async () => {
      const rows = await db.select().from(screenEntries).orderBy(desc(screenEntries.sessionDate));
      const screens = SCREEN_SOURCES.map((source): ScreenPerformance => {
        const entries = rows.filter((row) => row.screenKey === source.key);
        return {
          screenKey: source.key,
          screenName: source.name,
          entryCount: entries.length,
          firstSessionDate: entries.at(-1)?.sessionDate ?? null,
          horizons: {
            d1: summarize(entries.map((row) => ({ ret: row.ret1d, spy: row.spy1d }))),
            d5: summarize(entries.map((row) => ({ ret: row.ret5d, spy: row.spy5d }))),
            d20: summarize(entries.map((row) => ({ ret: row.ret20d, spy: row.spy20d }))),
          },
          recentEntries: entries.slice(0, 40).map((row) => ({ ticker: row.ticker, sessionDate: row.sessionDate, entryClose: row.entryClose, ret1d: row.ret1d, ret5d: row.ret5d, ret20d: row.ret20d })),
        };
      });
      const trackingSince = rows.length ? rows[rows.length - 1]!.sessionDate : null;
      return { screens, trackingSince };
    },
  });
}

/** 還有多少檔股票有到期、待補的報酬（回補時用來判斷要不要再跑一次）。 */
export async function countPendingEntries(db: Db): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(screenEntries).where(eq(screenEntries.completed, false));
  return Number(row?.count ?? 0);
}
