import { and, desc, eq, ne } from "drizzle-orm";
import type { Db } from "../db/client";
import { finvizScreenSnapshots, finvizSyncRuns } from "../db/schema";
import { SCREEN_SOURCES } from "./screenSources";

/**
 * 每日進出名單 + 連續上榜天數。
 *
 * 不需要新的資料表：finviz_screen_snapshots 本來就保留每次同步的完整名單，
 * 這裡只是往回讀最近 N 筆快照做比對。
 *
 * 「交易日」判定：同一個美股交易日可能有多筆快照（每日 cron + 手動同步、
 * 週末 cron 抓到的仍是週五收盤），所以先把快照歸到所屬的美股交易日再比對，
 * 否則週末會被誤算成「連續多上榜了兩天」、週一早上的新進名單也會是空的。
 */

/** 每個視角往回讀的快照筆數（含週末與手動同步，約 4 週）。 */
export const HISTORY_LOOKBACK_ROWS = 30;

type SnapshotStock = { ticker: string; company?: string };

export type HistorySnapshotInput = {
  fetchedAt: Date;
  stocks: SnapshotStock[];
};

export type ScreenHistory = {
  /** 最新一筆快照所屬的美股交易日（YYYY-MM-DD，紐約時間）。 */
  sessionDate: string | null;
  /** 比對基準：前一個有快照的美股交易日；沒有歷史時為 null。 */
  previousSessionDate: string | null;
  /** 這次新進榜（前一個交易日不在名單內）的代碼。 */
  newTickers: string[];
  /** 前一個交易日在、這次掉出的股票。 */
  dropped: Array<{ ticker: string; company: string }>;
  /** 每檔目前在榜股票「連續上榜的交易日數」（含今天，最小為 1）。 */
  streaks: Record<string, number>;
  /** 可比對的交易日數；streak 等於這個值時代表「至少」這麼多天（歷史視窗到頂）。 */
  sessionsAvailable: number;
};

const NY_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 把快照時間歸到所屬的美股交易日：
 * - 紐約時間 09:30 以前抓的，是前一個交易日的資料（例如台灣早上 06:00 的 cron）。
 * - 落在週六、週日的往回推到週五。
 * 美股假日不特別處理（會多算一天），對「連續上榜」的判讀影響很小。
 */
export function toUsSessionDate(at: Date): string {
  const parts = Object.fromEntries(NY_PARTS.formatToParts(at).map((part) => [part.type, part.value]));
  const wallClockMs = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  const shifted = new Date(wallClockMs - (9 * 60 + 30) * 60 * 1000);
  const weekday = shifted.getUTCDay();
  const rollback = weekday === 6 ? 1 : weekday === 0 ? 2 : 0;
  return new Date(shifted.getTime() - rollback * DAY_MS).toISOString().slice(0, 10);
}

/** 純函式：輸入同一視角「新到舊」排列的快照，算出進出名單與連續天數。 */
export function computeScreenHistory(snapshotsNewestFirst: HistorySnapshotInput[]): ScreenHistory {
  // 同一交易日只留最新那筆。
  const sessions: Array<{ date: string; tickers: Set<string>; stocks: SnapshotStock[] }> = [];
  for (const snapshot of snapshotsNewestFirst) {
    const date = toUsSessionDate(snapshot.fetchedAt);
    if (sessions.some((session) => session.date === date)) continue;
    sessions.push({ date, tickers: new Set(snapshot.stocks.map((stock) => stock.ticker)), stocks: snapshot.stocks });
  }

  const latest = sessions[0];
  if (!latest) {
    return { sessionDate: null, previousSessionDate: null, newTickers: [], dropped: [], streaks: {}, sessionsAvailable: 0 };
  }
  const previous = sessions[1];

  const streaks: Record<string, number> = {};
  for (const ticker of latest.tickers) {
    let count = 0;
    while (count < sessions.length && sessions[count]!.tickers.has(ticker)) count += 1;
    streaks[ticker] = count;
  }

  return {
    sessionDate: latest.date,
    previousSessionDate: previous?.date ?? null,
    newTickers: previous ? latest.stocks.map((stock) => stock.ticker).filter((ticker) => !previous.tickers.has(ticker)) : [],
    dropped: previous
      ? previous.stocks.filter((stock) => !latest.tickers.has(stock.ticker)).map((stock) => ({ ticker: stock.ticker, company: stock.company ?? "" }))
      : [],
    streaks,
    sessionsAvailable: sessions.length,
  };
}

function parseStocks(raw: string): SnapshotStock[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is SnapshotStock => typeof item === "object" && item !== null && typeof (item as SnapshotStock).ticker === "string")
      .map((item) => ({ ticker: item.ticker, company: item.company }));
  } catch {
    return [];
  }
}

/** 內部人資訊是交易事件而非「名單」，不適用進出比對，只算 7 個篩選視角。 */
export async function getScreenHistories(db: Db): Promise<Record<string, ScreenHistory>> {
  const entries = await Promise.all(
    SCREEN_SOURCES.map(async (source) => {
      const rows = await db
        .select({ fetchedAt: finvizScreenSnapshots.fetchedAt, stocks: finvizScreenSnapshots.stocks })
        .from(finvizScreenSnapshots)
        .where(eq(finvizScreenSnapshots.screenKey, source.key))
        .orderBy(desc(finvizScreenSnapshots.fetchedAt))
        .limit(HISTORY_LOOKBACK_ROWS);
      const history = computeScreenHistory(rows.map((row) => ({ fetchedAt: row.fetchedAt, stocks: parseStocks(row.stocks) })));
      return [source.key, history] as const;
    })
  );
  return Object.fromEntries(entries);
}

/**
 * 每日推播是否該發：只有這次 cron 跟上一次成功的 cron 落在不同的美股交易日才發，
 * 避免週日、週一早上（抓到的仍是週五資料）重複推同一份名單。
 */
export async function isNewSessionSinceLastCron(db: Db, currentRunId: number, currentStartedAt: Date): Promise<boolean> {
  const rows = await db
    .select({ startedAt: finvizSyncRuns.startedAt })
    .from(finvizSyncRuns)
    .where(and(eq(finvizSyncRuns.trigger, "cron"), ne(finvizSyncRuns.status, "failed"), ne(finvizSyncRuns.status, "running"), ne(finvizSyncRuns.id, currentRunId)))
    .orderBy(desc(finvizSyncRuns.startedAt))
    .limit(1);
  const previous = rows[0];
  if (!previous) return true;
  return toUsSessionDate(previous.startedAt) !== toUsSessionDate(currentStartedAt);
}
