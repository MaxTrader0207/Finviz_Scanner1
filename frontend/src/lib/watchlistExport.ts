export type WatchlistCsvRow = {
  ticker: string;
  company: string;
  source: string;
  sector: string;
  price: string;
  change: string;
  marketCap: string;
  pe: string;
  volume: string;
};

const CSV_HEADER = ["代碼", "公司", "來源策略", "產業", "股價", "漲跌幅", "市值", "本益比", "成交量"];

function escapeCsvField(value: string): string {
  const normalized = value.replace(/\r?\n/g, " ");
  return /[",]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

export function buildWatchlistCsv(rows: WatchlistCsvRow[]): string {
  const lines = [CSV_HEADER, ...rows.map((row) => [row.ticker, row.company, row.source, row.sector, row.price, row.change, row.marketCap, row.pe, row.volume])];
  return `\uFEFF${lines.map((line) => line.map(escapeCsvField).join(",")).join("\r\n")}\r\n`;
}

export function buildWatchlistCsvFileName(): string {
  return "Signal-Ledger-Watchlist.csv";
}
