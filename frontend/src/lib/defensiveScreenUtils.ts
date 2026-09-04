export const DEFENSIVE_PAGE_SIZE = 20;

export const DEFENSIVE_QUICK_SECTORS = [
  { value: "Financial", label: "金融" },
  { value: "Communication Services", label: "電信" },
  { value: "Utilities", label: "公用事業" },
] as const;

export function nextVisibleDefensiveCount(currentCount: number, totalCount: number): number {
  return Math.min(totalCount, Math.max(0, currentCount) + DEFENSIVE_PAGE_SIZE);
}

export function visibleDefensiveCount(currentCount: number, totalCount: number): number {
  return Math.min(Math.max(0, currentCount), Math.max(0, totalCount));
}

export function defensivePageCount(totalCount: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalCount) / DEFENSIVE_PAGE_SIZE));
}

export function defensivePageSlice<T>(items: T[], page: number): T[] {
  const safePage = Math.min(Math.max(1, page), defensivePageCount(items.length));
  const start = (safePage - 1) * DEFENSIVE_PAGE_SIZE;
  return items.slice(start, start + DEFENSIVE_PAGE_SIZE);
}
