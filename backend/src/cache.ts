/**
 * 原本 Express 版本用 `new Map()` 做記憶體快取，Cloudflare Workers 的
 * isolate 隨時可能被回收重建，記憶體快取效果不穩定。這裡改用 Workers
 * 原生的 Cache API（`caches.default`），是實際會持續存在於邊緣節點的快取，
 * 對「同一個 ticker 15 分鐘內重複請求」這種情境更有效。
 */
export async function withEdgeCache<T>(opts: {
  cacheKey: string;
  ttlSeconds: number;
  forceRefresh?: boolean;
  compute: () => Promise<T>;
}): Promise<T> {
  const cache = caches.default;
  const cacheRequest = new Request(`https://signal-ledger.internal/cache/${encodeURIComponent(opts.cacheKey)}`);

  if (!opts.forceRefresh) {
    const cached = await cache.match(cacheRequest);
    if (cached) return (await cached.json()) as T;
  }

  const value = await opts.compute();

  await cache.put(
    cacheRequest,
    new Response(JSON.stringify(value), {
      headers: { "content-type": "application/json", "cache-control": `max-age=${opts.ttlSeconds}` },
    })
  );

  return value;
}
