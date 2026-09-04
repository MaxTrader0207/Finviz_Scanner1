export const WATCHLIST_STORAGE_KEY = "signal-ledger-watchlist";
export const WATCHLIST_SOURCE_STORAGE_KEY = "signal-ledger-watchlist-sources";

export function parseWatchlist(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter((ticker): ticker is string => typeof ticker === "string").map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)));
  } catch {
    return [];
  }
}

export function toggleWatchlistTicker(currentTickers: string[], ticker: string): string[] {
  const normalized = ticker.trim().toUpperCase();
  return currentTickers.includes(normalized) ? currentTickers.filter((item) => item !== normalized) : [...currentTickers, normalized];
}

export function clearWatchlistTickers(): string[] {
  return [];
}

export function parseWatchlistSources(value: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([ticker, source]) => {
      const normalizedTicker = ticker.trim().toUpperCase();
      return normalizedTicker && typeof source === "string" && source.trim() ? [[normalizedTicker, source.trim()]] : [];
    }));
  } catch {
    return {};
  }
}
