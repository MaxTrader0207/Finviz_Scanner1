/**
 * Style reminder — Market Editorial: sorting is deterministic, traceable, and never reorders missing financial data as if it were a value.
 */
import type { Stock } from "./screenerData";

export type StockSortKey = "ticker" | "price" | "change" | "marketCapBn" | "volume" | "pe";
export type SortDirection = "asc" | "desc";
export type RankBadgeTier = "gold" | "silver" | "bronze";

const parsePe = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export function sortStocks(stocks: Stock[], key: StockSortKey, direction: SortDirection) {
  return [...stocks].sort((a, b) => {
    if (key === "pe") {
      const aPe = parsePe(a.pe);
      const bPe = parsePe(b.pe);
      if (aPe === null && bPe === null) return a.ticker.localeCompare(b.ticker);
      if (aPe === null) return 1;
      if (bPe === null) return -1;
      return direction === "asc" ? aPe - bPe : bPe - aPe;
    }

    const aValue = a[key];
    const bValue = b[key];
    const comparison = typeof aValue === "string" && typeof bValue === "string"
      ? aValue.localeCompare(bValue)
      : Number(aValue) - Number(bValue);
    return direction === "asc" ? comparison : -comparison;
  });
}

export function rankStocks(stocks: Stock[]) {
  return stocks.map((stock, index) => ({ stock, rank: index + 1 }));
}

export function getRankBadgeTier(rank: number): RankBadgeTier | null {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return null;
}
