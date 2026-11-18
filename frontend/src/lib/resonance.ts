import type { Screen, Stock } from "./screenerData";
import type { InsiderTransaction } from "./insiderTrading";
import type { ScreenHistory } from "./screenHistory";

/** 偏空的視角：同時出現在這裡與偏多視角時，前端會標示「訊號分歧」。 */
export const BEARISH_SCREEN_KEYS = new Set(["topLosers"]);

export type ResonanceHit = { screenKey: string; shortName: string; streak: number; isNew: boolean; bearish: boolean };

export type ResonanceRow = {
  ticker: string;
  stock: Stock;
  hits: ResonanceHit[];
  insiderBuy: { count: number; value: number } | null;
  insiderSale: { count: number; value: number } | null;
  /** 出現的視角數 + 有內部人買進則 +1 */
  score: number;
  /** 同時有偏多與偏空訊號 */
  hasConflict: boolean;
};

function sumTransactions(transactions: InsiderTransaction[], ticker: string) {
  const matched = transactions.filter((transaction) => transaction.ticker === ticker);
  if (!matched.length) return null;
  return { count: matched.length, value: matched.reduce((sum, transaction) => sum + transaction.value, 0) };
}

/** 純函式：找出同時出現在 2 個以上視角（內部人買進也算一個訊號）的股票。 */
export function computeResonance(
  screens: Screen[],
  histories: Record<string, ScreenHistory>,
  insider: { buy: InsiderTransaction[]; sale: InsiderTransaction[] } | null,
  minScore = 2
): ResonanceRow[] {
  const byTicker = new Map<string, { stock: Stock; hits: ResonanceHit[] }>();
  for (const screen of screens) {
    if (screen.key === "insiderTrading") continue;
    const history = histories[screen.key];
    for (const stock of screen.stocks) {
      const entry = byTicker.get(stock.ticker) ?? { stock, hits: [] };
      entry.hits.push({
        screenKey: screen.key,
        shortName: screen.shortName,
        streak: history?.streaks[stock.ticker] ?? 0,
        isNew: Boolean(history?.newTickers.includes(stock.ticker)),
        bearish: BEARISH_SCREEN_KEYS.has(screen.key),
      });
      byTicker.set(stock.ticker, entry);
    }
  }

  const rows: ResonanceRow[] = [];
  for (const [ticker, { stock, hits }] of Array.from(byTicker.entries())) {
    const insiderBuy = insider ? sumTransactions(insider.buy, ticker) : null;
    const insiderSale = insider ? sumTransactions(insider.sale, ticker) : null;
    const score = hits.length + (insiderBuy ? 1 : 0);
    if (score < minScore) continue;
    const hasBullish = hits.some((hit) => !hit.bearish) || Boolean(insiderBuy);
    const hasBearish = hits.some((hit) => hit.bearish) || Boolean(insiderSale);
    rows.push({ ticker, stock, hits, insiderBuy, insiderSale, score, hasConflict: hasBullish && hasBearish });
  }

  const totalStreak = (row: ResonanceRow) => row.hits.reduce((sum, hit) => sum + hit.streak, 0);
  return rows.sort((a, b) => b.score - a.score || totalStreak(b) - totalStreak(a) || a.ticker.localeCompare(b.ticker));
}

/** 資料是否過期：cron 每天一次，超過 26 小時沒更新就提醒。 */
export const STALE_AFTER_MS = 26 * 60 * 60 * 1000;
export function isStale(fetchedAt: number | null | undefined, now = Date.now()): boolean {
  return !fetchedAt || now - fetchedAt > STALE_AFTER_MS;
}
