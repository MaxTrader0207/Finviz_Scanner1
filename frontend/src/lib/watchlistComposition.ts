import type { Stock } from "./screenerData";

export type WatchlistSectorComposition = { sector: string; count: number; percentage: number };
export type SectorCompositionSortDirection = "asc" | "desc";

export function getWatchlistSectorComposition(stocks: Pick<Stock, "sector">[]): WatchlistSectorComposition[] {
  if (!stocks.length) return [];
  const counts = stocks.reduce<Record<string, number>>((current, stock) => {
    current[stock.sector] = (current[stock.sector] ?? 0) + 1;
    return current;
  }, {});
  return Object.entries(counts)
    .map(([sector, count]) => ({ sector, count, percentage: Number(((count / stocks.length) * 100).toFixed(1)) }))
    .sort((left, right) => right.count - left.count || left.sector.localeCompare(right.sector));
}

export function sortSectorComposition(items: WatchlistSectorComposition[], direction: SectorCompositionSortDirection): WatchlistSectorComposition[] {
  return [...items].sort((left, right) => {
    const percentageDifference = direction === "desc" ? right.percentage - left.percentage : left.percentage - right.percentage;
    return percentageDifference || left.sector.localeCompare(right.sector);
  });
}

export function getSectorChartAxisMax(items: Array<Pick<WatchlistSectorComposition, "count">>): number {
  return Math.max(1, ...items.map((item) => item.count)) * 1.25;
}
