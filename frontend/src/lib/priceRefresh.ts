export type PriceFetchMetadata = { fetchedAt: number };

/**
 * 一次請求塞太多股票代碼會讓 Cloudflare Worker 單次執行超過 CPU 時間上限
 * （尤其 forceRefresh 時要重新抓 + 解析每一檔的 Yahoo Finance 資料，不能吃
 * 快取）。把股票清單拆成小批次、分開發送多次請求，讓每次請求各自有自己的
 * CPU 時間額度，而不是全部塞在同一次請求裡疊加。
 */
export const PRICE_HISTORY_CHUNK_SIZE = 8;

export function chunkTickers(tickers: string[], size: number = PRICE_HISTORY_CHUNK_SIZE): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < tickers.length; i += size) {
    chunks.push(tickers.slice(i, i + size));
  }
  return chunks;
}

export type PriceHistoryBatchResult<T> = { histories: Record<string, T>; unavailable: string[] };

/**
 * 依序（非平行）對每個批次呼叫 fetchBatch，並把結果合併成單一物件。
 * 依序而非平行是刻意的：平行送出多個批次一樣會同時佔用同一個 Worker 的
 * 資源，達不到「拆開來讓每批次各自輕量」的效果。
 */
export async function fetchPriceHistoriesChunked<T>(
  tickers: string[],
  fetchBatch: (tickerChunk: string[]) => Promise<PriceHistoryBatchResult<T>>,
  chunkSize: number = PRICE_HISTORY_CHUNK_SIZE
): Promise<PriceHistoryBatchResult<T>> {
  const histories: Record<string, T> = {};
  const unavailable: string[] = [];

  for (const chunk of chunkTickers(tickers, chunkSize)) {
    const result = await fetchBatch(chunk);
    Object.assign(histories, result.histories);
    unavailable.push(...result.unavailable);
  }

  return { histories, unavailable };
}

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
