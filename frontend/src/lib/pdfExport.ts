export function buildDefaultPdfFileName(ticker: string, company: string) {
  return sanitizePdfFileName(`Signal-Ledger-${ticker}-${company}-AI-Summary`);
}

export function buildWatchlistPdfFileName() {
  return "Signal-Ledger-Watchlist";
}

export function sanitizePdfFileName(value: string) {
  const cleaned = value
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 96);
  return cleaned || "Signal-Ledger-AI-Summary";
}
