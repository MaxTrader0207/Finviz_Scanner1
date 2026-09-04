import { describe, expect, it } from "vitest";
import { formatPriceUpdatedAt, getLatestCloseByTicker, getLatestPriceFetchedAt } from "./priceRefresh";

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
  it("formats a fetchedAt timestamp with date and time", () => {
    const formatted = formatPriceUpdatedAt(Date.UTC(2026, 7, 28, 9, 5, 7));
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/08/);
    expect(formatted).toMatch(/28/);
    expect(formatted).toMatch(/09:05:07/);
  });

  it("shows a clear empty state without a timestamp", () => {
    expect(formatPriceUpdatedAt(null)).toBe("尚未取得");
  });
});
