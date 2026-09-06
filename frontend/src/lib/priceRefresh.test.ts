import { describe, expect, it, vi } from "vitest";
import { chunkTickers, fetchPriceHistoriesChunked, formatPriceUpdatedAt, getLatestCloseByTicker, getLatestPriceFetchedAt, PRICE_HISTORY_CHUNK_SIZE } from "./priceRefresh";

describe("chunkTickers", () => {
  it("splits a ticker list into groups no larger than the chunk size", () => {
    const tickers = Array.from({ length: 19 }, (_, i) => `T${i}`);
    const chunks = chunkTickers(tickers, 8);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(8);
    expect(chunks[1]).toHaveLength(8);
    expect(chunks[2]).toHaveLength(3);
    expect(chunks.flat()).toEqual(tickers);
  });

  it("defaults to PRICE_HISTORY_CHUNK_SIZE when no size is given", () => {
    const tickers = Array.from({ length: PRICE_HISTORY_CHUNK_SIZE + 1 }, (_, i) => `T${i}`);
    expect(chunkTickers(tickers)).toHaveLength(2);
  });

  it("returns a single empty-list result for an empty input", () => {
    expect(chunkTickers([])).toEqual([]);
  });
});

describe("fetchPriceHistoriesChunked", () => {
  it("calls fetchBatch once per chunk, sequentially, and merges the results", async () => {
    const tickers = ["A", "B", "C", "D", "E"];
    const calls: string[][] = [];
    const fetchBatch = vi.fn(async (chunk: string[]) => {
      calls.push(chunk);
      return {
        histories: Object.fromEntries(chunk.map((t) => [t, { fetchedAt: 1 }])),
        unavailable: [],
      };
    });

    const result = await fetchPriceHistoriesChunked(tickers, fetchBatch, 2);

    expect(calls).toEqual([["A", "B"], ["C", "D"], ["E"]]);
    expect(Object.keys(result.histories).sort()).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("merges the unavailable list across chunks", async () => {
    const fetchBatch = vi.fn(async (chunk: string[]) => ({
      histories: {},
      unavailable: chunk,
    }));

    const result = await fetchPriceHistoriesChunked(["A", "B", "C"], fetchBatch, 2);
    expect(result.unavailable.sort()).toEqual(["A", "B", "C"]);
  });
});

describe("getLatestPriceFetchedAt", () => {
  it("returns the newest fetchedAt across the current batch", () => {
    expect(getLatestPriceFetchedAt({ ALM: { fetchedAt: 100 }, BP: { fetchedAt: 250 }, EE: { fetchedAt: 180 } })).toBe(250);
  });

  it("returns null before any price history is available", () => {
    expect(getLatestPriceFetchedAt(undefined)).toBeNull();
    expect(getLatestPriceFetchedAt({})).toBeNull();
  });
});

describe("getLatestCloseByTicker", () => {
  it("uses the most recent close for each ticker", () => {
    const closes = getLatestCloseByTicker({
      ALM: { points: [{ close: 10 }, { close: 12.5 }] },
      BP: { points: [{ close: 99 }] },
    });

    expect(closes.get("ALM")).toBe(12.5);
    expect(closes.get("BP")).toBe(99);
  });

  it("ignores tickers without a finite close", () => {
    const closes = getLatestCloseByTicker({ ALM: { points: [] }, BP: { points: [{ close: Number.NaN }] } });
    expect(closes.size).toBe(0);
  });
});

describe("formatPriceUpdatedAt", () => {
  it("formats a fetchedAt timestamp in Asia/Taipei time, regardless of the machine's local timezone", () => {
    // 09:05:07 UTC = 17:05:07 台北時間（UTC+8）。timeZone 是明確寫死的，
    // 這個結果在任何機器、任何 CI 環境上執行都應該一致，不能依賴系統時區。
    const formatted = formatPriceUpdatedAt(Date.UTC(2026, 7, 28, 9, 5, 7));
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/08/);
    expect(formatted).toMatch(/28/);
    expect(formatted).toMatch(/17:05:07/);
  });

  it("shows a clear empty state without a timestamp", () => {
    expect(formatPriceUpdatedAt(null)).toBe("尚未取得");
  });
});
