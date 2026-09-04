import { DEFENSIVE_INCOME_STOCKS } from "./defensiveIncomeData";

/**
 * Style reminder — Market Editorial: factual source data only; deep indigo, copper, and teal signal semantics.
 */

export type ScreenKey = "qualityMomentum" | "microShort" | "newHighMomentum" | "megaValueQuality" | "defensiveIncomeValue" | "topGainers" | "topLosers" | "insiderTrading";

export type Stock = {
  ticker: string;
  company: string;
  sector: string;
  industry: string;
  country: string;
  marketCapLabel: string;
  marketCapBn: number;
  pe: string;
  price: number;
  change: number;
  volume: number;
  defensiveMetrics?: {
    dividendYield: string;
    payoutRatio: string;
    priceToBook: string;
    beta: string;
    snapshotSource: "Finviz";
  };
};

export type Screen = {
  key: ScreenKey;
  name: string;
  shortName: string;
  navLabel: string;
  eyebrow: string;
  note: string;
  sourceUrl: string;
  snapshotAt: string;
  snapshotTotal?: number;
  loadedScope?: string;
  filters: string[];
  signal: string;
  caution: string;
  stocks: Stock[];
};

const qualityMomentum: Stock[] = [
  { ticker: "ALM", company: "Almonty Industries Inc", sector: "Basic Materials", industry: "Other Industrial Metals & Mining", country: "USA", marketCapLabel: "5.10B", marketCapBn: 5.1, pe: "72.15", price: 17.69, change: 9.33, volume: 10509362 },
  { ticker: "AUPH", company: "Aurinia Pharmaceuticals Inc", sector: "Healthcare", industry: "Biotechnology", country: "Canada", marketCapLabel: "2.30B", marketCapBn: 2.3, pe: "7.55", price: 17.27, change: 6.8, volume: 2637100 },
  { ticker: "BP", company: "BP plc ADR", sector: "Energy", industry: "Oil & Gas Integrated", country: "United Kingdom", marketCapLabel: "116.25B", marketCapBn: 116.25, pe: "21.74", price: 45.14, change: 3.22, volume: 10747637 },
  { ticker: "CAI", company: "Caris Life Sciences Inc", sector: "Healthcare", industry: "Biotechnology", country: "USA", marketCapLabel: "6.95B", marketCapBn: 6.95, pe: "66.02", price: 24.58, change: 8, volume: 6033339 },
  { ticker: "CGAU", company: "Centerra Gold Inc", sector: "Basic Materials", industry: "Gold", country: "Canada", marketCapLabel: "4.59B", marketCapBn: 4.59, pe: "7.49", price: 23.49, change: 3.94, volume: 1449785 },
  { ticker: "DOW", company: "Dow Inc", sector: "Basic Materials", industry: "Chemicals", country: "USA", marketCapLabel: "23.77B", marketCapBn: 23.77, pe: "-", price: 32.9, change: 3.62, volume: 14366264 },
  { ticker: "DRD", company: "DRDGold Ltd ADR", sector: "Basic Materials", industry: "Gold", country: "South Africa", marketCapLabel: "2.55B", marketCapBn: 2.55, pe: "14.23", price: 29.51, change: 6.04, volume: 411942 },
  { ticker: "EE", company: "Excelerate Energy Inc", sector: "Energy", industry: "Oil & Gas Midstream", country: "USA", marketCapLabel: "4.46B", marketCapBn: 4.46, pe: "27.11", price: 39.36, change: 3.2, volume: 642666 },
  { ticker: "ERO", company: "Ero Copper Corp", sector: "Basic Materials", industry: "Copper", country: "Canada", marketCapLabel: "3.76B", marketCapBn: 3.76, pe: "12.16", price: 36.02, change: 5.69, volume: 1682063 },
  { ticker: "GFI", company: "Gold Fields Ltd ADR", sector: "Basic Materials", industry: "Gold", country: "South Africa", marketCapLabel: "40.68B", marketCapBn: 40.68, pe: "11.50", price: 45.45, change: 3.65, volume: 4295095 },
  { ticker: "HMY", company: "Harmony Gold Mining Co Ltd ADR", sector: "Basic Materials", industry: "Gold", country: "South Africa", marketCapLabel: "13.76B", marketCapBn: 13.76, pe: "15.20", price: 22.02, change: 4.41, volume: 3571047 },
  { ticker: "IAG", company: "Iamgold Corp", sector: "Basic Materials", industry: "Gold", country: "Canada", marketCapLabel: "11.71B", marketCapBn: 11.71, pe: "10.38", price: 20.5, change: 3.96, volume: 7083203 },
  { ticker: "KGC", company: "Kinross Gold Corp", sector: "Basic Materials", industry: "Gold", country: "Canada", marketCapLabel: "37.28B", marketCapBn: 37.28, pe: "11.92", price: 31.43, change: 5.12, volume: 10711287 },
  { ticker: "NOG", company: "Northern Oil and Gas Inc", sector: "Energy", industry: "Oil & Gas E&P", country: "USA", marketCapLabel: "2.87B", marketCapBn: 2.87, pe: "-", price: 26.91, change: 3.26, volume: 2473700 },
  { ticker: "PR", company: "Permian Resources Holdings Inc", sector: "Energy", industry: "Oil & Gas E&P", country: "USA", marketCapLabel: "19.99B", marketCapBn: 19.99, pe: "15.84", price: 23.87, change: 3.69, volume: 12744956 },
  { ticker: "SDRL", company: "Seadrill Ltd", sector: "Energy", industry: "Oil & Gas Drilling", country: "Bermuda", marketCapLabel: "2.98B", marketCapBn: 2.98, pe: "2800.58", price: 47.89, change: 3.52, volume: 457444 },
  { ticker: "SM", company: "SM Energy Co", sector: "Energy", industry: "Oil & Gas E&P", country: "USA", marketCapLabel: "8.95B", marketCapBn: 8.95, pe: "7.42", price: 37.64, change: 4.15, volume: 4929141 },
  { ticker: "SSRM", company: "SSR Mining Inc", sector: "Basic Materials", industry: "Gold", country: "USA", marketCapLabel: "7.51B", marketCapBn: 7.51, pe: "33.97", price: 36.83, change: 4.1, volume: 3845334 },
  { ticker: "TALO", company: "Talos Energy Inc", sector: "Energy", industry: "Oil & Gas E&P", country: "USA", marketCapLabel: "2.96B", marketCapBn: 2.96, pe: "-", price: 17.75, change: 3.38, volume: 2595035 },
];

const microShort: Stock[] = [
  { ticker: "ZCMD", company: "Zhongchao Inc", sector: "Healthcare", industry: "Health Information Services", country: "China", marketCapLabel: "1.01M", marketCapBn: 0.00101, pe: "-", price: 0.88, change: 8.93, volume: 8873150 },
  { ticker: "BTCT", company: "BTC Digital Ltd", sector: "Technology", industry: "Computer Hardware", country: "Singapore", marketCapLabel: "19.94M", marketCapBn: 0.01994, pe: "-", price: 2.10, change: 15.75, volume: 16681702 },
  { ticker: "BRNX", company: "BrenX Ltd", sector: "Utilities", industry: "Utilities - Renewable", country: "Israel", marketCapLabel: "6.10M", marketCapBn: 0.00610, pe: "-", price: 8.46, change: 35.58, volume: 6896602 },
];

const defensiveIncomeValue: Stock[] = DEFENSIVE_INCOME_STOCKS;

const topGainers: Stock[] = [
  { ticker: "RFAI", company: "RF Acquisition Corp II", sector: "Financial", industry: "Shell Companies", country: "Singapore", marketCapLabel: "483.94M", marketCapBn: 0.48394, pe: "622.32", price: 58, change: 355.62, volume: 3150789 },
  { ticker: "HOWL", company: "Werewolf Therapeutics Inc", sector: "Healthcare", industry: "Biotechnology", country: "USA", marketCapLabel: "42.45M", marketCapBn: 0.04245, pe: "-", price: 0.87, change: 102.57, volume: 296734530 },
  { ticker: "USDE", company: "StableCoinX Inc", sector: "Financial", industry: "Capital Markets", country: "USA", marketCapLabel: "201.46M", marketCapBn: 0.20146, pe: "-", price: 7.41, change: 85.25, volume: 98971190 },
  { ticker: "KNRX", company: "Knorex Ltd", sector: "Technology", industry: "Software - Application", country: "USA", marketCapLabel: "—", marketCapBn: 0, pe: "-", price: 0.52, change: 57.58, volume: 144317528 },
  { ticker: "SDOT", company: "Sadot Group Inc", sector: "Consumer Defensive", industry: "Farm Products", country: "USA", marketCapLabel: "17.40M", marketCapBn: 0.0174, pe: "-", price: 13.18, change: 56.16, volume: 19613391 },
  { ticker: "AIAI", company: "AIAI Holdings Corp", sector: "Industrials", industry: "Conglomerates", country: "USA", marketCapLabel: "518.10M", marketCapBn: 0.5181, pe: "-", price: 6.62, change: 46.14, volume: 13128467 },
  { ticker: "EXYN", company: "Exyn Technologies Inc", sector: "Technology", industry: "Software - Infrastructure", country: "USA", marketCapLabel: "17.58M", marketCapBn: 0.01758, pe: "-", price: 2.21, change: 39.87, volume: 16068075 },
  { ticker: "LSTA", company: "Lisata Therapeutics Inc", sector: "Healthcare", industry: "Biotechnology", country: "USA", marketCapLabel: "13.97M", marketCapBn: 0.01397, pe: "-", price: 1.55, change: 38.39, volume: 7120557 },
  { ticker: "AMCI", company: "AMC Robotics Corp", sector: "Technology", industry: "Computer Hardware", country: "USA", marketCapLabel: "146.90M", marketCapBn: 0.1469, pe: "-", price: 6.5, change: 32.65, volume: 223443 },
  { ticker: "NCTY", company: "The9 Limited ADR", sector: "Financial", industry: "Capital Markets", country: "China", marketCapLabel: "86.76M", marketCapBn: 0.08676, pe: "-", price: 5.78, change: 32.57, volume: 911139 },
];

const topLosers: Stock[] = [
  { ticker: "MI", company: "NFT Ltd", sector: "Consumer Cyclical", industry: "Internet Retail", country: "Hong Kong", marketCapLabel: "0.69M", marketCapBn: 0.00069, pe: "-", price: 3, change: -58.51, volume: 541650 },
  { ticker: "SUGP", company: "SU Group Holdings Ltd", sector: "Industrials", industry: "Security & Protection Services", country: "Hong Kong", marketCapLabel: "2.58M", marketCapBn: 0.00258, pe: "-", price: 1.6, change: -42.34, volume: 40254259 },
  { ticker: "GDC", company: "GD Culture Group Limited", sector: "Communication Services", industry: "Electronic Gaming & Multimedia", country: "USA", marketCapLabel: "6.49M", marketCapBn: 0.00649, pe: "-", price: 1.56, change: -37.35, volume: 11027090 },
  { ticker: "CDTG", company: "CDT Environmental Technology Investment Holdings Ltd", sector: "Industrials", industry: "Waste Management", country: "China", marketCapLabel: "3.56M", marketCapBn: 0.00356, pe: "-", price: 1.18, change: -35.52, volume: 4986101 },
  { ticker: "JZ", company: "Jianzhi Education Technology Group Co Ltd ADR", sector: "Technology", industry: "Information Technology Services", country: "China", marketCapLabel: "0.57M", marketCapBn: 0.00057, pe: "-", price: 2.2, change: -33.73, volume: 1040200 },
  { ticker: "LGCL", company: "Lucas GC Ltd", sector: "Technology", industry: "Software - Application", country: "China", marketCapLabel: "2.44M", marketCapBn: 0.00244, pe: "0.00", price: 0.06, change: -31.33, volume: 123368911 },
  { ticker: "PFSA", company: "Profusa Inc", sector: "Healthcare", industry: "Medical Devices", country: "USA", marketCapLabel: "3.31M", marketCapBn: 0.00331, pe: "-", price: 5.46, change: -27.87, volume: 647694 },
  { ticker: "ISPC", company: "iSpecimen Inc", sector: "Healthcare", industry: "Diagnostics & Research", country: "USA", marketCapLabel: "4.26M", marketCapBn: 0.00426, pe: "-", price: 1.69, change: -25.55, volume: 1546619 },
  { ticker: "SGLY", company: "Singularity Future Technology Ltd", sector: "Industrials", industry: "Integrated Freight & Logistics", country: "USA", marketCapLabel: "2.31M", marketCapBn: 0.00231, pe: "-", price: 2.57, change: -25.29, volume: 1374773 },
  { ticker: "BTCT", company: "BTC Digital Ltd", sector: "Technology", industry: "Computer Hardware", country: "Singapore", marketCapLabel: "10.85M", marketCapBn: 0.01085, pe: "-", price: 1.14, change: -22.45, volume: 17075774 },
];

export const screens: Screen[] = [
  {
    key: "qualityMomentum",
    name: "中大型股獲利動能",
    shortName: "獲利動能",
    navLabel: "品質 × 動能",
    eyebrow: "QUALITY × MOMENTUM",
    note: "以正 EPS 季增、正營業利益率、單日上漲 3% 以上與 RSI 逾 60，找出價格低於 50 美元的中大型動能股。",
    sourceUrl: "https://finviz.com/screener?v=111&f=cap_midover,fa_epsqoq_pos,fa_opermargin_pos,sh_price_u50,ta_change_u3,ta_rsi_ob60",
    snapshotAt: "2026.08.21 · GMT+8",
    filters: ["市值 ≥ 20 億美元", "EPS 季增為正", "營業利益率為正", "股價 < 50 美元", "日變動 > 3%", "RSI(14) > 60"],
    signal: "基本面與價格動能同向",
    caution: "篩選結果不代表估值合理或後續報酬。",
    stocks: qualityMomentum,
  },
  {
    key: "microShort",
    name: "微型股高空頭動能",
    shortName: "微型股空頭",
    navLabel: "微型 × 空頭",
    eyebrow: "MICROCAP × SHORT INTEREST",
    note: "鎖定市值低於 3 億美元、股價低於 10 美元、流通與相對成交量偏高、已發行股數低於 2,000 萬且高空頭比率的微型股。",
    sourceUrl: "https://finviz.com/screener?v=111&f=cap_microunder%2Csh_curvol_o1000%2Csh_outstanding_u20%2Csh_price_u10%2Csh_relvol_o1.5%2Csh_short_high%2Ctad_0_close%3A%3Aclose%3Ad&ft=4&o=price",
    snapshotAt: "2026.08.27 · 12:40 ET",
    snapshotTotal: 3,
    loadedScope: "Finviz Overview 第 1 頁 · 3 檔",
    filters: ["市值 < 3 億美元", "目前成交量 > 100 萬", "已發行股 < 2,000 萬", "股價 < 10 美元", "相對成交量 > 1.5", "空頭比率高 (>20%)"],
    signal: "低流通量與高空頭共同放大價格敏感度",
    caution: "高空頭與高相對量可能意味著極高波動與流動性風險。",
    stocks: microShort,
  },
  {
    key: "newHighMomentum",
    name: "52 週新高動能",
    shortName: "新高動能",
    navLabel: "新高 × 趨勢",
    eyebrow: "NEW HIGH × TREND",
    note: "鎖定平均成交量與相對量偏高、創 52 週新高、近 13 週上漲、位於 SMA20 與 SMA50 之上，並排除 RSI(14) 逾 60 的過熱狀態。",
    sourceUrl: "https://finviz.com/screener?v=111&f=sh_avgvol_o500%2Csh_relvol_o1.5%2Cta_highlow52w_nh%2Cta_perf_13wup%2Cta_rsi_nob60%2Cta_sma20_pa%2Cta_sma50_pa%2Ctad_0_close%3A%3Aclose%3Ad&ft=4&o=price",
    snapshotAt: "2026.08.21 · GMT+8",
    filters: ["平均成交量 > 500K", "相對成交量 > 1.5", "52 週新高", "近 13 週上漲", "RSI(14) < 60", "價格 > SMA20", "價格 > SMA50"],
    signal: "本次快照沒有同時符合所有條件的標的",
    caution: "0 檔代表此時點沒有符合嚴格條件交集的標的，不代表該條件未來不會出現結果。",
    stocks: [],
  },
  {
    key: "megaValueQuality",
    name: "低價大型品質成長",
    shortName: "大型品質",
    navLabel: "大型 × 品質",
    eyebrow: "MEGACAP × QUALITY",
    note: "鎖定市值至少 2,000 億美元、EPS 年增與五年營收成長均逾 10%、P/E 低於 25、ROE 高於 15%，且股價低於 10 美元的超大型企業。",
    sourceUrl: "https://finviz.com/screener?v=111&f=cap_mega%2Cfa_epsyoy1_o10%2Cfa_pe_u25%2Cfa_roe_o15%2Cfa_sales5years_o10%2Csh_price_u10%2Ctad_0_close%3A%3Aclose%3Ad&ft=4&o=price",
    snapshotAt: "2026.08.21 · GMT+8",
    filters: ["市值 ≥ 2,000 億美元", "EPS 年增 > 10%", "P/E < 25", "ROE > 15%", "5 年營收成長 > 10%", "股價 < 10 美元"],
    signal: "本次快照沒有同時符合所有條件的標的",
    caution: "超大型市值、低絕對股價及成長品質條件的組合十分嚴格；0 檔不代表投資觀點。",
    stocks: [],
  },
  {
    key: "defensiveIncomeValue",
    name: "穩健收息與價值防禦型多頭",
    shortName: "收息防禦",
    navLabel: "收息 × 防禦",
    eyebrow: "INCOME × VALUE × DEFENSE",
    note: "以股息殖利率、配息紀律、正營業利益率、低 P/B、機構持股與低 Beta，篩選兼具收息與波動防禦特徵的價值型標的。",
    sourceUrl: "https://finviz.com/screener?v=121&f=fa_div_o3%2Cfa_opermargin_pos%2Cfa_payoutratio_u60%2Cfa_pb_u2%2Csh_instown_o50%2Csh_price_o10%2Cta_beta_u1%2Ctad_0_close%3A%3Aclose%3Ad&ft=4&o=price",
    snapshotAt: "2026.08.22 · 01:55–01:59 ET",
    snapshotTotal: 71,
    loadedScope: "完整 71 檔 Finviz 快照；每頁呈現 20 檔，可使用分頁逐步查看。",
    filters: ["股息殖利率 > 3%", "營業利益率為正", "配息率 < 60%", "P/B < 2", "機構持股 > 50%", "股價 > 10 美元", "Beta < 1"],
    signal: "收息、估值與低 Beta 防禦條件交集",
    caution: "殖利率與配息率可能隨盈餘、股價及公司政策變動；低 Beta 不代表下跌風險消失。",
    stocks: defensiveIncomeValue,
  },
  {
    key: "topGainers",
    name: "Top Gainers · 當日漲幅居前",
    shortName: "Top Gainers",
    navLabel: "當日漲幅前十",
    eyebrow: "TOP GAINERS · FINVIZ SIGNAL",
    note: "依 Finviz Signal「Top Gainers」擷取 Overview 第 1 頁前 10 名；以當日漲跌幅由高至低排序。",
    sourceUrl: "https://finviz.com/screener?v=111&s=ta_topgainers",
    snapshotAt: "2026.08.22 · 06:22 ET",
    snapshotTotal: 10,
    loadedScope: "Finviz Top Gainers 第 1 頁前 10 名；KNRX 未列市值，合計市值僅計可取得的 9 檔。",
    filters: ["Finviz Signal：Top Gainers", "Overview 第 1 頁", "當日漲跌幅由高至低", "前 10 名"],
    signal: "依 Finviz Top Gainers 訊號排序的當日強勢股",
    caution: "單日大幅上漲常伴隨高波動與流動性風險，排序不代表估值、基本面或後續報酬。",
    stocks: topGainers,
  },
  {
    key: "topLosers",
    name: "Top Losers · 當日跌幅居前",
    shortName: "Top Losers",
    navLabel: "當日跌幅前十",
    eyebrow: "TOP LOSERS · FINVIZ SIGNAL",
    note: "依 Finviz Signal「Top Losers」擷取 Overview 第 1 頁前 10 名；以當日漲跌幅由低至高排序。",
    sourceUrl: "https://finviz.com/screener?v=111&s=ta_toplosers",
    snapshotAt: "2026.08.22 · 06:23 ET",
    snapshotTotal: 10,
    loadedScope: "Finviz Top Losers 第 1 頁前 10 名。",
    filters: ["Finviz Signal：Top Losers", "Overview 第 1 頁", "當日漲跌幅由低至高", "前 10 名"],
    signal: "依 Finviz Top Losers 訊號排序的當日弱勢股",
    caution: "單日大幅下跌可能涉及高波動、流動性或事件風險，排序不代表估值、基本面或後續報酬。",
    stocks: topLosers,
  },
  {
    key: "insiderTrading",
    name: "內部人資訊",
    shortName: "內部人資訊",
    navLabel: "買入 × 賣出",
    eyebrow: "INSIDER TRANSACTIONS",
    note: "整理 Finviz 最新 Form 4 買入與賣出交易快照；可分別依交易股數或交易金額檢視兩端前十筆交易。",
    sourceUrl: "https://finviz.com/insidertrading?tc=1",
    snapshotAt: "2026.08.22 · 03:50–03:52 ET",
    loadedScope: "Finviz 買入與賣出交易頁各 200 筆表列；介面依所選排序顯示前 10 筆。",
    filters: ["內部人買入交易", "內部人賣出／擬賣出交易", "#Shares 可雙向排序", "Value ($) 可雙向排序", "每區前 10 筆"],
    signal: "交易股數與金額的雙向排序快照",
    caution: "內部人交易可能因預定計畫、選擇權或資產配置而發生，單筆交易不代表個人化投資建議。",
    stocks: [],
  },
];
