export type PriceFetchMetadata = { fetchedAt: number };

export function getLatestPriceFetchedAt(histories: Record<string, PriceFetchMetadata> | undefined): number | null {
  const fetchedAtValues = Object.values(histories ?? {})
    .map((history) => history.fetchedAt)
    .filter((timestamp): timestamp is number => Number.isFinite(timestamp));

  return fetchedAtValues.length ? Math.max(...fetchedAtValues) : null;
}

export function getLatestCloseByTicker<T extends { points: Array<{ close: number }> }>(histories: Record<string, T> | undefined): Map<string, number> {
  return new Map(
    Object.entries(histories ?? {})
      .map(([ticker, history]) => [ticker, history.points.at(-1)?.close] as const)
      .filter((entry): entry is readonly [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])),
  );
}

export function formatPriceUpdatedAt(timestamp: number | null): string {
  if (timestamp === null || !Number.isFinite(timestamp)) return "尚未取得";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}
