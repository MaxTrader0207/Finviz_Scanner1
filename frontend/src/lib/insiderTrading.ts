export type InsiderSortKey = "shares" | "value";
export type InsiderSortDirection = "asc" | "desc";

export type InsiderTransaction = {
  ticker: string;
  owner: string;
  relationship: string;
  date: string;
  transaction: "Buy" | "Sale" | "Proposed Sale";
  cost: number;
  shares: number;
  value: number;
};

export const INSIDER_SNAPSHOT_AT = "2026.08.22 · 03:50–03:52 ET";
export const INSIDER_SOURCE_URLS = {
  buy: "https://finviz.com/insidertrading?tc=1",
  sale: "https://finviz.com/insidertrading?tc=2",
} as const;

const record = (ticker: string, owner: string, relationship: string, date: string, transaction: InsiderTransaction["transaction"], cost: number, shares: number, value: number): InsiderTransaction => ({ ticker, owner, relationship, date, transaction, cost, shares, value });

// This compact snapshot preserves every top/bottom-ten transaction necessary for
// the two requested sort keys from Finviz's 200-row buy table at the stated time.
export const insiderBuyTransactions: InsiderTransaction[] = [
  record("ZNTL", "WALTERS GROUP", "10% Owner", "Aug 14 '26", "Buy", 3.5, 4_335_000, 15_172_500),
  record("EENHA", "Apeiron Investment Group Ltd.", "Director", "Aug 19 '26", "Buy", 1.66, 1_674_316, 2_778_446),
  record("AEON", "LYNCH TIMOTHY P", "10% Owner", "Aug 19 '26", "Buy", 0.21, 1_150_000, 243_455),
  record("IAUX", "Young Richard Scott", "President and CEO", "Aug 18 '26", "Buy", 1.62, 1_000_000, 1_620_000),
  record("PPAM", "Mindlin Marcos Marcelo", "Director", "Aug 19 '26", "Buy", 3.34, 902_975, 3_015_034),
  record("GWRS", "Levine Jonathan L", "Director", "Aug 20 '26", "Buy", 8.85, 651_618, 5_766_819),
  record("ET", "WARREN KELCY L", "Director", "Aug 19 '26", "Buy", 21.26, 647_968, 13_775_800),
  record("DXST", "Sun Dingxin", "Director", "Aug 06 '26", "Buy", 2, 400_000, 800_000),
  record("PPAM", "Mindlin Marcos Marcelo", "Director", "Aug 18 '26", "Buy", 3.35, 396_950, 1_327_798),
  record("ET", "WARREN KELCY L", "Director", "Aug 18 '26", "Buy", 21.27, 352_032, 7_487_721),
  record("RSG", "CASCADE INVESTMENT, L.L.C.", "10% Owner", "Aug 18 '26", "Buy", 217.9, 200_125, 43_607_661),
  record("RSG", "CASCADE INVESTMENT, L.L.C.", "10% Owner", "Aug 19 '26", "Buy", 222.51, 178_844, 39_795_277),
  record("COE", "Huang Jack Jiajia", "Chief Executive Officer", "Apr 10 '26", "Buy", 21.07, 151_620, 3_194_633),
  record("AMR", "Courtis Kenneth S.", "Director", "Aug 20 '26", "Buy", 193.5, 15_000, 2_902_552),
  record("TPL", "HORIZON KINETICS ASSET MANAGEM", "10% Owner", "Aug 20 '26", "Buy", 377.85, 1, 378),
  record("TPL", "HORIZON KINETICS ASSET MANAGEM", "10% Owner", "Aug 19 '26", "Buy", 372.1, 1, 372),
  record("MDRR", "Winn Charles Brent Jr.", "CHIEF FINANCIAL OFFICER", "Aug 20 '26", "Buy", 11.5, 3, 34),
  record("FGBI", "WALKER ROBERT W", "Director", "Aug 18 '26", "Buy", 18.95, 8, 152),
  record("YORW", "Brossman Douglas S", "Director", "Aug 20 '26", "Buy", 33.19, 30, 1_000),
  record("BHRB", "WILSON DAVID", "Director", "Aug 20 '26", "Buy", 70.57, 35, 2_470),
  record("FCNCA", "Morais Diane E.", "Director", "Aug 19 '26", "Buy", 2_168.11, 50, 108_405),
  record("DLHC", "Mink Brook Asset Management LL", "10% Owner", "Aug 20 '26", "Buy", 4.55, 70, 318),
  record("ARLP", "McDaniel Ronna R.", "Director", "Aug 18 '26", "Buy", 25.81, 70, 1_800),
  record("MDRR", "Winn Charles Brent Jr.", "CHIEF FINANCIAL OFFICER", "Aug 19 '26", "Buy", 11.5, 72, 828),
  record("BRLT", "Grossberg Eric Scott", "Executive Chairman", "Aug 19 '26", "Buy", 1.26, 381, 480),
  record("LOOP", "GEYGAN JEFFREY RICHART", "Director", "Aug 19 '26", "Buy", 0.64, 1_090, 700),
  record("PPML", "BANK OF AMERICA CORP /DE/", "10% Owner", "Aug 18 '26", "Buy", 7.45, 100, 745),
  record("BAC", "BANK OF AMERICA CORP /DE/", "10% Owner", "Aug 18 '26", "Buy", 7.45, 100, 745),
];

// This compact snapshot preserves every top/bottom-ten transaction necessary for
// the two requested sort keys from Finviz's 200-row sale table at the stated time.
export const insiderSaleTransactions: InsiderTransaction[] = [
  record("DGNX", "Pelham Miles Christian", "Director", "Aug 17 '26", "Sale", 1, 6_908_540, 6_908_540),
  record("MANE", "MONTANOVA CAPITAL, LLC", "Director", "Aug 19 '26", "Sale", 107.25, 750_000, 80_437_500),
  record("CBRS", "Lie Sean", "Chief Technology Officer", "Aug 20 '26", "Sale", 207.86, 710_247, 147_628_770),
  record("GDRX", "FRANCISCO PARTNERS IV, L.P.", "10% Owner", "Aug 19 '26", "Sale", 3.53, 471_975, 1_666_025),
  record("GDRX", "FRANCISCO PARTNERS IV, L.P.", "10% Owner", "Aug 20 '26", "Sale", 3.52, 447_259, 1_574_575),
  record("LZ", "Watson Noel Bertram", "Chief Operating Officer & CFO", "Aug 20 '26", "Sale", 5.91, 416_371, 2_460_753),
  record("ILMN", "Meister Keith A.", "Director", "Aug 21 '26", "Sale", 217.96, 299_336, 65_243_445),
  record("DGNX", "Pelham Miles Christian", "Director", "Aug 17 '26", "Sale", 1, 294_380, 294_380),
  record("ILMN", "Meister Keith A.", "Director", "Aug 20 '26", "Sale", 213.86, 285_238, 61_000_127),
  record("GDRX", "FRANCISCO PARTNERS IV, L.P.", "10% Owner", "Aug 21 '26", "Sale", 3.5, 274_717, 960_630),
  record("CBRS", "ANDREW FELDMAN", "Director", "Aug 21 '26", "Proposed Sale", 209.85, 237_559, 49_851_756),
  record("ILMN", "Meister Keith A.", "Director", "Aug 19 '26", "Sale", 203.29, 95_000, 19_312_827),
  record("RVMD", "MARK A GOLDSMITH", "Director", "Aug 21 '26", "Proposed Sale", 211.74, 80_000, 16_938_800),
  record("STX", "MOSLEY WILLIAM D", "Officer", "Aug 21 '26", "Proposed Sale", 849.35, 18_200, 15_458_257),
  record("DE", "CAMPBELL RYAN D", "Officer", "Aug 21 '26", "Proposed Sale", 651.18, 23_260, 15_146_386),
  record("AUGO", "Kapitalo International Fund SP", "May be deemed affiliate", "Aug 21 '26", "Proposed Sale", 88.11, 157_586, 13_885_610),
  record("ISRG", "Brosius Mark", "EVP & Chief Mfg and Supply Cha", "Aug 20 '26", "Sale", 396.37, 77, 30_520),
  record("ISRG", "Brosius Mark", "EVP & Chief Mfg and Supply Cha", "Aug 21 '26", "Sale", 375.57, 77, 28_919),
  record("MRCY", "Munro Douglas", "SVP, CAO", "Aug 20 '26", "Sale", 97.67, 109, 10_646),
  record("ANET", "Kelly Battles", "Director", "Aug 21 '26", "Proposed Sale", 146.44, 422, 61_797),
  record("LITE", "Wupen Yuen", "PRESIDENT, GLOBAL BUS. UNITS", "Aug 21 '26", "Sale", 898.15, 500, 449_075),
  record("MRCY", "Munro Douglas", "SVP, CAO", "Aug 19 '26", "Sale", 100.31, 548, 54_968),
  record("UPST", "Mirgorodskaya Natalia", "See Remarks", "Aug 20 '26", "Sale", 28.09, 586, 16_461),
  record("ROK", "Rothe Christian E", "Sr. VP and CFO", "Aug 20 '26", "Sale", 434.3, 590, 256_237),
  record("QCOM", "Grech Patricia Y", "SVP, Chief Accounting Officer", "Aug 21 '26", "Sale", 162.85, 625, 101_781),
  record("QCOM", "GRECH FAMILY TRUST", "Officer", "Aug 21 '26", "Proposed Sale", 162.85, 625, 101_781),
  record("ZSTK", "Rong Rudy", "President", "Aug 19 '26", "Sale", 7.57, 1_000, 7_570),
  record("ARDX", "Hohenleitner Susan", "Officer", "Aug 21 '26", "Proposed Sale", 4.03, 2_650, 10_680),
  record("ARDX", "Reilly Joseph James", "Officer", "Aug 21 '26", "Proposed Sale", 4.03, 4_700, 18_941),
  record("CBLL", "Foehr David", "Officer", "Aug 21 '26", "Proposed Sale", 24.02, 993, 23_854),
  record("PTON", "Baig Saqib", "Chief Accounting Officer", "Aug 19 '26", "Sale", 5.45, 4_912, 26_780),
  record("PDYN", "Trevor Thatcher", "Officer", "Aug 21 '26", "Proposed Sale", 6.16, 4_636, 28_552),
  record("PDYN", "THATCHER TREVOR", "CHIEF FINANCIAL OFFICER", "Aug 21 '26", "Sale", 6.16, 4_636, 28_553),
];

export function getTopInsiderTransactions(transactions: InsiderTransaction[], key: InsiderSortKey, direction: InsiderSortDirection, limit = 10) {
  const multiplier = direction === "desc" ? -1 : 1;
  return [...transactions]
    .sort((left, right) => (left[key] - right[key]) * multiplier || left.ticker.localeCompare(right.ticker))
    .slice(0, limit);
}

const INSIDER_SECTOR_BY_TICKER: Record<string, string> = {
  AEON: "Healthcare", AMR: "Basic Materials", ANET: "Technology", ARDX: "Healthcare", ARLP: "Energy", AUGO: "Basic Materials", BAC: "Financial", BHRB: "Financial", BRLT: "Consumer Cyclical", CBLL: "Healthcare", COE: "Consumer Defensive", DE: "Industrials", DLHC: "Industrials", DXST: "Industrials", ET: "Energy", FGBI: "Financial", FCNCA: "Financial", GDRX: "Healthcare", GWRS: "Utilities", IAUX: "Basic Materials", ILMN: "Healthcare", ISRG: "Healthcare", LITE: "Technology", LOOP: "Basic Materials", LZ: "Industrials", MANE: "Healthcare", MDRR: "Real Estate", MRCY: "Industrials", PDYN: "Technology", PTON: "Consumer Cyclical", QCOM: "Technology", ROK: "Industrials", RSG: "Industrials", RVMD: "Healthcare", STX: "Technology", TPL: "Energy", YORW: "Utilities", ZNTL: "Healthcare",
};

export function getInsiderTickerSector(ticker: string): string {
  return INSIDER_SECTOR_BY_TICKER[ticker.trim().toUpperCase()] ?? "未分類";
}

export type InsiderSectorComposition = { sector: string; count: number; percentage: number };

export function getInsiderSectorComposition(transactions: InsiderTransaction[]): InsiderSectorComposition[] {
  const uniqueTickers = Array.from(new Set(transactions.map((transaction) => transaction.ticker)));
  const sectorCounts = new Map<string, number>();
  uniqueTickers.forEach((ticker) => {
    const sector = getInsiderTickerSector(ticker);
    sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
  });
  return Array.from(sectorCounts.entries()).map(([sector, count]) => ({ sector, count, percentage: uniqueTickers.length ? (count / uniqueTickers.length) * 100 : 0 }));
}
