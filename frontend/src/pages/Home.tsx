/**
 * Style reminder — Market Editorial: Research-room composition with a fixed indigo rail, parchment data stage,
 * DM Serif Display headlines, and copper / teal semantic signals. Avoid generic centered SaaS panels.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "../mobile.css";
import "../insiderTrading.css";
import "../priceTrend.css";
import "../watchlist.css";
import "../zeroResults.css";
import {
  Activity,
  ArrowUpDown,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Database,
  Download,
  ExternalLink,
  Landmark,
  Layers,
  Loader2,
  Plus,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { type ScreenKey, type Stock } from "@/lib/screenerData";
import { useScreens } from "@/lib/useScreens";
import { calculateMacd, calculateRsi, calculateSimpleMovingAverage, findLatestRsiExtremeEntry, getAllMovingAveragePeriods, getRsiZone, getVisibleMovingAveragePeriods, MOVING_AVERAGE_PRESENTATIONS, MOVING_AVERAGE_VISIBILITY_STORAGE_KEY, parseVisibleMovingAveragePeriods, type MovingAveragePeriod, RSI_REFERENCE_BANDS, summarizeLatestMovingAverage } from "@/lib/movingAverage";
import { buildDefaultPdfFileName, buildWatchlistPdfFileName, sanitizePdfFileName } from "@/lib/pdfExport";
import { buildWatchlistCsv, buildWatchlistCsvFileName } from "@/lib/watchlistExport";
import { getRankBadgeTier, rankStocks, sortStocks, type SortDirection, type StockSortKey } from "@/lib/stockSorting";
import { defensivePageCount, defensivePageSlice, DEFENSIVE_PAGE_SIZE, DEFENSIVE_QUICK_SECTORS } from "@/lib/defensiveScreenUtils";
import { getStockCardMetrics } from "@/lib/stockCardMetrics";
import { clearWatchlistTickers, parseWatchlist, parseWatchlistSources, toggleWatchlistTicker, WATCHLIST_SOURCE_STORAGE_KEY, WATCHLIST_STORAGE_KEY } from "@/lib/watchlist";
import { getSectorChartAxisMax, getWatchlistSectorComposition, sortSectorComposition, type SectorCompositionSortDirection } from "@/lib/watchlistComposition";
import { buildMiniCandleGeometry, getMiniCandlePoints, MINI_CANDLE_POINT_LIMIT } from "@/lib/miniCandleChart";
import { fetchPriceHistoriesChunked, formatPriceUpdatedAt, getLatestCloseByTicker, getLatestPriceFetchedAt } from "@/lib/priceRefresh";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { scrollToScreenTop } from "@/lib/screenNavigation";
import { getInsiderSectorComposition, getInsiderTickerSector, getTopInsiderTransactions, insiderBuyTransactions, insiderSaleTransactions, INSIDER_SNAPSHOT_AT, INSIDER_SOURCE_URLS, type InsiderSortDirection, type InsiderSortKey, type InsiderTransaction } from "@/lib/insiderTrading";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

type SortKey = StockSortKey;
type PricePoint = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };
type MiniPriceHistory = { points: PricePoint[]; fetchedAt: number; rangeLabel: string };

const formatVolume = (value: number) =>
  value >= 1_000_000 ? `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M` : `${(value / 1000).toFixed(0)}K`;

const formatUsd = (value: number) => `$${value.toFixed(2)}`;

const formatMarketCap = (value: number) =>
  value >= 1 ? `$${value.toFixed(value >= 100 ? 0 : 2)}B` : `$${(value * 1000).toFixed(2)}M`;

function StatCard({ label, value, note, accent = "teal" }: { label: string; value: string; note: string; accent?: "teal" | "copper" | "ink" }) {
  return (
    <article className="stat-card">
      <div className={`stat-rule ${accent}`} />
      <p className="eyebrow">{label}</p>
      <p className="stat-value">{value}</p>
      <p className="stat-note">{note}</p>
    </article>
  );
}

function SortableHeading({ label, column, active, direction, onSort }: { label: string; column: SortKey; active: SortKey; direction: SortDirection; onSort: (key: SortKey) => void }) {
  const isActive = active === column;
  return (
    <button type="button" className={`table-heading ${isActive ? "active" : ""}`} onClick={() => onSort(column)} title={`依${label}${isActive && direction === "asc" ? "遞增" : "遞減"}排序`}>
      {label}
      <ArrowUpDown size={12} strokeWidth={2.1} className={isActive && direction === "asc" ? "sort-up" : ""} />
    </button>
  );
}

const formatInsiderNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

function InsiderTransactionsPanel({ title, eyebrow, transactions, sourceUrl, tone, watchlistTickers, onToggleWatchlist }: { title: string; eyebrow: string; transactions: InsiderTransaction[]; sourceUrl: string; tone: "buy" | "sale"; watchlistTickers: string[]; onToggleWatchlist: (ticker: string) => void }) {
  const [sortKey, setSortKey] = useState<InsiderSortKey>("value");
  const [sortDirection, setSortDirection] = useState<InsiderSortDirection>("desc");
  const rows = useMemo(() => getTopInsiderTransactions(transactions, sortKey, sortDirection), [sortDirection, sortKey, transactions]);
  const chooseSortKey = (key: InsiderSortKey) => {
    if (key === sortKey) setSortDirection((direction) => direction === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDirection("desc"); }
  };
  return <article className={`insider-panel ${tone}`}>
    <header className="insider-panel-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>依所選排序呈現 Finviz 交易快照前 10 筆。</p></div><span className="insider-count">TOP 10</span></header>
    <div className="insider-sort-controls" role="group" aria-label={`${title}排序`}><span><ArrowUpDown size={14} /> 排序依據</span><button type="button" data-role={`insider-${tone}-shares`} className={sortKey === "shares" ? "active" : ""} onClick={() => chooseSortKey("shares")} aria-pressed={sortKey === "shares"}>#Shares</button><button type="button" data-role={`insider-${tone}-value`} className={sortKey === "value" ? "active" : ""} onClick={() => chooseSortKey("value")} aria-pressed={sortKey === "value"}>Value ($)</button><button type="button" className="insider-direction" data-role={`insider-${tone}-direction`} onClick={() => setSortDirection((direction) => direction === "desc" ? "asc" : "desc")} aria-label={`目前由${sortDirection === "desc" ? "高至低" : "低至高"}排序，點擊切換`}>{sortDirection === "desc" ? "高 → 低" : "低 → 高"}</button></div>
    <div className="insider-transaction-list" data-role={`insider-${tone}-list`}>{rows.map((transaction, index) => { const isFavorite = watchlistTickers.includes(transaction.ticker); return <article className="insider-transaction insider-stock-card" key={`${transaction.ticker}-${transaction.owner}-${transaction.date}-${transaction.shares}-${transaction.value}`}><div className="insider-card-primary"><span className="insider-rank">{String(index + 1).padStart(2, "0")}</span><div className="insider-identity"><strong>{transaction.ticker}</strong><span>{transaction.owner}</span><small>{transaction.relationship} · {transaction.date} · {transaction.transaction}</small></div></div><div className="insider-card-metrics"><span><small>成交類型</small><b>{transaction.transaction}</b></span><span><small>交易成本</small><b>${transaction.cost.toFixed(2)}</b></span><span><small>#Shares</small><b>{formatInsiderNumber(transaction.shares)}</b></span><span><small>Value ($)</small><b>${formatInsiderNumber(transaction.value)}</b></span></div><button type="button" className={`insider-watchlist-toggle ${isFavorite ? "is-favorite" : ""}`} data-role={`insider-${tone}-watchlist-${transaction.ticker}`} onClick={() => onToggleWatchlist(transaction.ticker)} aria-label={isFavorite ? `從自選股移除 ${transaction.ticker}` : `加入 ${transaction.ticker} 至自選股`}>{isFavorite ? <X size={15} /> : <Plus size={16} />}</button></article>; })}</div>
    <footer><span>資料時間：{INSIDER_SNAPSHOT_AT}</span><a href={sourceUrl} target="_blank" rel="noreferrer">查看 Finviz 原始交易 <ArrowUpRight size={12} /></a></footer>
  </article>;
}

function InsiderTradingView({ sectorData, sectorAxisMax, sectorDirection, onToggleSectorDirection, watchlistTickers, onToggleWatchlist }: { sectorData: Array<{ name: string; count: number; percentageLabel: string }>; sectorAxisMax: number; sectorDirection: SectorCompositionSortDirection; onToggleSectorDirection: () => void; watchlistTickers: string[]; onToggleWatchlist: (ticker: string) => void }) {
  return <section className="insider-trading-view" aria-label="內部人買入與賣出交易"><header className="insider-view-heading"><div><p className="eyebrow">LATEST FORM 4 SNAPSHOT</p><h2>內部人買入與賣出</h2><p>買入與賣出區塊各自獨立排序；#Shares 與 Value ($) 均可切換高至低或低至高。</p></div><span>各 10 筆</span></header><article className="sector-panel insider-sector-panel" aria-label="內部人交易產業構成"><div className="section-head"><div><p className="eyebrow">COMPOSITION</p><h2>產業構成</h2></div><div className="sector-panel-actions"><span className="small-data">{sectorData.length} 類</span><button type="button" className="sector-sort-button" data-role="insider-sector-sort" onClick={onToggleSectorDirection} aria-label={`目前內部人交易產業佔比由${sectorDirection === "desc" ? "高至低" : "低至高"}排序，點擊切換`}><ArrowUpDown size={12} />{sectorDirection === "desc" ? "高→低" : "低→高"}</button></div></div>{sectorData.length ? <div className="sector-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={sectorData} layout="vertical" margin={{ top: 3, right: 54, bottom: 3, left: 4 }}><XAxis type="number" hide domain={[0, sectorAxisMax]} /><YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} tick={{ fill: "#626a67", fontSize: 11, fontFamily: "Noto Sans TC" }} /><Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={18}>{sectorData.map((entry, index) => <Cell key={entry.name} fill={index === 0 ? "#147B72" : "#c08b48"} />)}<LabelList dataKey="percentageLabel" position="right" fill="#33444a" fontSize={11} fontFamily="Noto Sans TC" /></Bar></BarChart></ResponsiveContainer></div> : <div className="sector-empty"><Layers size={19} /><p>本次快照無產業資料</p></div>}</article><div className="insider-trading-grid"><InsiderTransactionsPanel title="內部人買入" eyebrow="INSIDER BUY" transactions={insiderBuyTransactions} sourceUrl={INSIDER_SOURCE_URLS.buy} tone="buy" watchlistTickers={watchlistTickers} onToggleWatchlist={onToggleWatchlist} /><InsiderTransactionsPanel title="內部人賣出" eyebrow="INSIDER SALE" transactions={insiderSaleTransactions} sourceUrl={INSIDER_SOURCE_URLS.sale} tone="sale" watchlistTickers={watchlistTickers} onToggleWatchlist={onToggleWatchlist} /></div><p className="insider-disclosure"><CircleAlert size={15} /> 產業構成以買入與賣出快照中去重後的代碼計算；未列於 Finviz Overview 的代碼歸為「未分類」。Sale 與 Proposed Sale 均列入賣出區塊，交易不構成個人化投資建議。</p></section>;
}

export default function Home() {
  const { screens, isLive, lastSyncedAt, staleScreenKeys } = useScreens();
  const [activeScreen, setActiveScreen] = useState<ScreenKey>(() => {
    const storedScreen = window.localStorage.getItem("signal-ledger-active-screen");
    return screens.some((item) => item.key === storedScreen) ? storedScreen as ScreenKey : "qualityMomentum";
  });
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("全部產業");
  const [defensivePage, setDefensivePage] = useState(1);
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>(() => parseWatchlist(window.localStorage.getItem(WATCHLIST_STORAGE_KEY)));
  const [watchlistSources, setWatchlistSources] = useState<Record<string, string>>(() => parseWatchlistSources(window.localStorage.getItem(WATCHLIST_SOURCE_STORAGE_KEY)));
  const [watchlistSourceFilter, setWatchlistSourceFilter] = useState("全部來源");
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [isWatchlistClearDialogOpen, setIsWatchlistClearDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("change");
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => window.localStorage.getItem("signal-ledger-active-screen") === "topLosers" ? "asc" : "desc");
  const [sectorCompositionDirection, setSectorCompositionDirection] = useState<SectorCompositionSortDirection>("desc");
  const [insiderSectorCompositionDirection, setInsiderSectorCompositionDirection] = useState<SectorCompositionSortDirection>("desc");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [summaryStock, setSummaryStock] = useState<Stock | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof trpc.stockSummary.generate.useMutation>>["data"] | null>(null);
  const [isSummaryExporting, setIsSummaryExporting] = useState(false);
  const [summaryFileName, setSummaryFileName] = useState("");
  const [summaryExportMessage, setSummaryExportMessage] = useState("");
  const [isPriceRefreshing, setIsPriceRefreshing] = useState(false);
  const [priceRefreshError, setPriceRefreshError] = useState<string | null>(null);
  const [lastPriceUpdatedAt, setLastPriceUpdatedAt] = useState<number | null>(null);
  const summaryExportRef = useRef<HTMLDivElement>(null);
  const stockSummary = trpc.stockSummary.generate.useMutation({
    onSuccess: (result) => setSummary(result),
  });

  useEffect(() => {
    window.localStorage.setItem("signal-ledger-active-screen", activeScreen);
  }, [activeScreen]);

  useEffect(() => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistTickers));
  }, [watchlistTickers]);

  useEffect(() => {
    window.localStorage.setItem(WATCHLIST_SOURCE_STORAGE_KEY, JSON.stringify(watchlistSources));
  }, [watchlistSources]);

  const screen = screens.find((item) => item.key === activeScreen) ?? screens[0];
  const insiderWatchlistStocks = useMemo(() => Array.from(new Map([...insiderBuyTransactions, ...insiderSaleTransactions].map((transaction) => [transaction.ticker, transaction])).values()).map((transaction) => ({ ticker: transaction.ticker, company: "內部人交易快照標的", sector: getInsiderTickerSector(transaction.ticker), industry: "Finviz Form 4 交易", country: "—", marketCapLabel: "—", marketCapBn: 0, pe: "—", price: transaction.cost, change: 0, volume: 0 })), []);
  const stockByTicker = useMemo(() => new Map([...insiderWatchlistStocks, ...screens.flatMap((item) => item.stocks)].map((stock) => [stock.ticker, stock])), [insiderWatchlistStocks]);
  const favoriteStocks = useMemo(() => watchlistTickers.map((ticker) => stockByTicker.get(ticker)).filter((stock): stock is Stock => Boolean(stock)), [stockByTicker, watchlistTickers]);
  const getDefaultSourceNameForTicker = (ticker: string) => screens.find((item) => item.stocks.some((stock) => stock.ticker === ticker))?.shortName ?? (insiderWatchlistStocks.some((stock) => stock.ticker === ticker) ? "內部人資訊" : "已儲存標的");
  const sourceNameForTicker = (ticker: string) => watchlistSources[ticker] ?? getDefaultSourceNameForTicker(ticker);
  const watchlistSourceOptions = useMemo(() => Array.from(new Set(favoriteStocks.map((stock) => sourceNameForTicker(stock.ticker)))), [favoriteStocks, watchlistSources]);
  const filteredFavoriteStocks = useMemo(() => watchlistSourceFilter === "全部來源" ? favoriteStocks : favoriteStocks.filter((stock) => sourceNameForTicker(stock.ticker) === watchlistSourceFilter), [favoriteStocks, watchlistSourceFilter, watchlistSources]);
  const watchlistSectorComposition = useMemo(() => getWatchlistSectorComposition(filteredFavoriteStocks), [filteredFavoriteStocks]);
  const sortedWatchlistSectorComposition = useMemo(() => sortSectorComposition(watchlistSectorComposition, sectorCompositionDirection), [sectorCompositionDirection, watchlistSectorComposition]);
  const watchlistSectorData = useMemo(() => sortedWatchlistSectorComposition.map((item) => ({
    name: item.sector,
    count: item.count,
    percentage: item.percentage,
    percentageLabel: `${item.percentage.toFixed(1)}%`,
  })), [sortedWatchlistSectorComposition]);
  const watchlistSectorAxisMax = useMemo(() => getSectorChartAxisMax(watchlistSectorData), [watchlistSectorData]);
  const insiderSectorData = useMemo(() => sortSectorComposition(getInsiderSectorComposition([...insiderBuyTransactions, ...insiderSaleTransactions]), insiderSectorCompositionDirection).map((item) => ({ name: item.sector, count: item.count, percentageLabel: `${item.percentage.toFixed(1)}%` })), [insiderSectorCompositionDirection]);
  const insiderSectorAxisMax = useMemo(() => getSectorChartAxisMax(insiderSectorData), [insiderSectorData]);
  const isDefensiveScreen = screen.key === "defensiveIncomeValue";
  const isInsiderScreen = screen.key === "insiderTrading";
  const isTopLosersScreen = screen.key === "topLosers";
  const sectors = useMemo(() => ["全部產業", ...Array.from(new Set(screen.stocks.map((stock) => stock.sector)))], [screen]);

  const visibleStocks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredStocks = screen.stocks.filter((stock) => {
        const matchesQuery = !normalizedQuery || [stock.ticker, stock.company, stock.industry, stock.country].some((value) => value.toLowerCase().includes(normalizedQuery));
        const matchesSector = sector === "全部產業" || stock.sector === sector;
        return matchesQuery && matchesSector;
      });
    return sortStocks(filteredStocks, sortKey, sortDirection);
  }, [query, screen, sector, sortDirection, sortKey]);
  const rankedStocks = useMemo(() => rankStocks(visibleStocks), [visibleStocks]);
  const defensivePageTotal = useMemo(() => defensivePageCount(rankedStocks.length), [rankedStocks.length]);
  const activeDefensivePage = Math.min(defensivePage, defensivePageTotal);
  const renderedRankedStocks = useMemo(() => isDefensiveScreen ? defensivePageSlice(rankedStocks, activeDefensivePage) : rankedStocks, [activeDefensivePage, isDefensiveScreen, rankedStocks]);
  const priceHistoryInput = useMemo(() => ({ tickers: renderedRankedStocks.map(({ stock }) => stock.ticker) }), [renderedRankedStocks]);
  const priceHistoryUtils = trpc.useUtils();
  const queryClient = useQueryClient();
  // 一次對後端請求太多股票代碼（forceRefresh 時尤其明顯）會讓單次 Cloudflare
  // Worker 執行超過 CPU 時間上限，所以改用 fetchPriceHistoriesChunked 拆成
  // 小批次分開請求，而不是直接用 trpc.priceHistory.list.useQuery 整批送出。
  const priceHistoryQueryKey = useMemo(() => ["priceHistoryChunked", ...priceHistoryInput.tickers], [priceHistoryInput.tickers]);
  const miniPriceHistories = useQuery({
    queryKey: priceHistoryQueryKey,
    queryFn: () => fetchPriceHistoriesChunked(priceHistoryInput.tickers, (chunk) => priceHistoryUtils.priceHistory.list.fetch({ tickers: chunk })),
    enabled: priceHistoryInput.tickers.length > 0,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
  const currentPrices = useMemo(() => getLatestCloseByTicker(miniPriceHistories.data?.histories), [miniPriceHistories.data]);
  const latestFetchedAt = useMemo(() => getLatestPriceFetchedAt(miniPriceHistories.data?.histories), [miniPriceHistories.data]);

  useEffect(() => {
    if (latestFetchedAt !== null) setLastPriceUpdatedAt(latestFetchedAt);
  }, [latestFetchedAt]);

  async function refreshCurrentPrices() {
    if (!priceHistoryInput.tickers.length || isPriceRefreshing) return;
    setIsPriceRefreshing(true);
    setPriceRefreshError(null);
    try {
      const refreshed = await fetchPriceHistoriesChunked(priceHistoryInput.tickers, (chunk) =>
        priceHistoryUtils.priceHistory.list.fetch({ tickers: chunk, forceRefresh: true })
      );
      queryClient.setQueryData(priceHistoryQueryKey, refreshed);
      const refreshedAt = getLatestPriceFetchedAt(refreshed.histories);
      if (refreshedAt !== null) setLastPriceUpdatedAt(refreshedAt);
      toast.success("目前股價已更新", { description: `已重新取得 ${priceHistoryInput.tickers.length} 檔 Yahoo Finance 最新日線資料。` });
    } catch (error) {
      console.error("[Price Refresh] Unable to refresh current prices", error);
      setPriceRefreshError("更新失敗，請稍後再試。");
      toast.error("目前股價更新失敗", { description: "Yahoo Finance 暫時無法回應，畫面仍保留上次資料。" });
    } finally {
      setIsPriceRefreshing(false);
    }
  }

  const stats = useMemo(() => {
    const stockCount = screen.stocks.length;
    const sourceCount = screen.snapshotTotal ?? stockCount;
    const averageChange = stockCount ? screen.stocks.reduce((sum, stock) => sum + stock.change, 0) / stockCount : null;
    const totalVolume = screen.stocks.reduce((sum, stock) => sum + stock.volume, 0);
    const totalMarketCap = screen.stocks.reduce((sum, stock) => sum + stock.marketCapBn, 0);
    return { stockCount, sourceCount, averageChange, totalVolume, totalMarketCap };
  }, [screen]);

  const sectorData = useMemo(() => sortSectorComposition(getWatchlistSectorComposition(screen.stocks), sectorCompositionDirection).map((item) => ({
    name: item.sector,
    count: item.count,
    percentage: item.percentage,
    percentageLabel: `${item.percentage.toFixed(1)}%`,
  })), [screen, sectorCompositionDirection]);
  const sectorAxisMax = useMemo(() => getSectorChartAxisMax(sectorData), [sectorData]);

  const leadingMove = useMemo(() => [...screen.stocks].sort((a, b) => isTopLosersScreen ? a.change - b.change : b.change - a.change)[0] ?? null, [isTopLosersScreen, screen]);

  function changeScreen(key: ScreenKey) {
    setActiveScreen(key);
    scrollToScreenTop(window.scrollTo.bind(window));
    setExpandedTicker(null);
    setQuery("");
    setSector("全部產業");
    setSortKey("change");
    setSortDirection(key === "topLosers" ? "asc" : "desc");
    setDefensivePage(1);
  }

  useEffect(() => {
    setDefensivePage(1);
  }, [activeScreen, query, sector, sortKey, sortDirection]);

  useEffect(() => {
    if (watchlistSourceFilter !== "全部來源" && !watchlistSourceOptions.includes(watchlistSourceFilter)) setWatchlistSourceFilter("全部來源");
  }, [watchlistSourceFilter, watchlistSourceOptions]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDirection(key === "ticker" ? "asc" : "desc");
    }
  }

  function toggleWatchlist(stock: Stock | string, source?: string) {
    const ticker = typeof stock === "string" ? stock : stock.ticker;
    const normalizedTicker = ticker.trim().toUpperCase();
    const isAdding = !watchlistTickers.includes(normalizedTicker);
    setWatchlistTickers((current) => toggleWatchlistTicker(current, normalizedTicker));
    setWatchlistSources((current) => {
      if (isAdding) return { ...current, [normalizedTicker]: source ?? getDefaultSourceNameForTicker(normalizedTicker) };
      const next = { ...current };
      delete next[normalizedTicker];
      return next;
    });
    if (isAdding) toast.success(`已加入 ${normalizedTicker} 至自選股`, { description: `來源：${source ?? getDefaultSourceNameForTicker(normalizedTicker)} · 可於頁尾自選股查看。`, duration: 2800 });
  }

  function clearWatchlist() {
    setWatchlistTickers(clearWatchlistTickers());
    setWatchlistSources({});
    setWatchlistSourceFilter("全部來源");
    setIsWatchlistClearDialogOpen(false);
  }

  function openWatchlistFromSwitcher() {
    setIsWatchlistOpen(true);
    window.setTimeout(() => document.getElementById("watchlist-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function requestSummary(stock: Stock) {
    setExpandedTicker(stock.ticker);
    setSummaryStock(stock);
    setSummary(null);
    setSummaryFileName(buildDefaultPdfFileName(stock.ticker, stock.company));
    setSummaryExportMessage("");
    stockSummary.mutate({
      ...stock,
      screenName: screen.name,
      screenFilters: screen.filters,
      sourceUrl: screen.sourceUrl,
      snapshotAt: screen.snapshotAt,
    });
  }

  async function exportSummaryPdf() {
    if (!summaryStock || !summary || !summaryExportRef.current) return;
    const chart = document.querySelector<HTMLElement>(`[data-role="pdf-detail-chart"][data-ticker="${summaryStock.ticker}"]`);
    if (!chart || chart.classList.contains("detail-price-chart-state")) {
      setSummaryExportMessage("正在準備目前細節圖表，請稍候圖表載入完成後再匯出。");
      return;
    }
    setIsSummaryExporting(true);
    setSummaryExportMessage("");
    try {
      const printable = summaryExportRef.current.cloneNode(true) as HTMLDivElement;
      printable.classList.add("pdf-export-capture");
      printable.style.width = "720px";
      printable.style.maxHeight = "none";
      printable.style.overflow = "visible";
      const chartPrintable = document.createElement("div");
      chartPrintable.className = "pdf-chart-capture";
      chartPrintable.style.width = "720px";
      chartPrintable.append(Object.assign(document.createElement("p"), { className: "pdf-chart-kicker", textContent: "CURRENT DETAIL CHART" }), Object.assign(document.createElement("h2"), { textContent: `${summaryStock.ticker} · ${summaryStock.company}` }), chart.cloneNode(true));
      document.body.appendChild(printable);
      document.body.appendChild(chartPrintable);
      const canvas = await html2canvas(printable, { backgroundColor: "#fcfaf4", scale: 2, useCORS: true, logging: false });
      const chartCanvas = await html2canvas(chartPrintable, { backgroundColor: "#fcfaf4", scale: 2, useCORS: true, logging: false });
      printable.remove();
      chartPrintable.remove();
      const pdf = new jsPDF({ format: "a4", orientation: "portrait", unit: "pt" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 30;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;
      const addCanvasPages = (source: HTMLCanvasElement, startOnNewPage: boolean) => {
        const renderedHeight = (source.height * printableWidth) / source.width;
        const image = source.toDataURL("image/png");
        let firstFragment = true;
        for (let offset = 0; offset < renderedHeight; offset += printableHeight) {
          if ((startOnNewPage && firstFragment) || !firstFragment) pdf.addPage();
          pdf.addImage(image, "PNG", margin, margin - offset, printableWidth, renderedHeight, undefined, "FAST");
          firstFragment = false;
        }
      };
      addCanvasPages(canvas, false);
      addCanvasPages(chartCanvas, true);
      const filename = sanitizePdfFileName(summaryFileName);
      pdf.save(`${filename}.pdf`);
      setSummaryExportMessage(`已匯出 ${filename}.pdf，內容包含 AI 摘要與目前細節圖表。`);
    } catch (error) {
      console.error("[AI Summary PDF Export]", error);
      setSummaryExportMessage("PDF 產生失敗，請確認細節圖表已完整載入後再試。\n");
    } finally {
      setIsSummaryExporting(false);
    }
  }

  function exportWatchlistCsv() {
    if (!filteredFavoriteStocks.length || !isWatchlistOpen) return;
    const csv = buildWatchlistCsv(filteredFavoriteStocks.map((stock) => ({
      ticker: stock.ticker,
      company: stock.company,
      source: sourceNameForTicker(stock.ticker),
      sector: stock.sector,
      price: formatUsd(stock.price),
      change: `${stock.change >= 0 ? "+" : ""}${stock.change.toFixed(2)}%`,
      marketCap: stock.marketCapLabel,
      pe: stock.pe,
      volume: formatVolume(stock.volume),
    })));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = buildWatchlistCsvFileName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success("自選股 CSV 已開始下載", { description: `已匯出 ${filteredFavoriteStocks.length} 檔${watchlistSourceFilter === "全部來源" ? "" : `（來源：${watchlistSourceFilter}）`}。` });
  }

  async function exportWatchlistPdf() {
    if (!filteredFavoriteStocks.length) return;
    const exportedAt = new Date().toLocaleString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const printable = document.createElement("article");
    printable.className = "watchlist-pdf-export";
    const header = document.createElement("header");
    const kicker = document.createElement("p");
    kicker.textContent = "SIGNAL LEDGER · PERSONAL WATCHLIST";
    const title = document.createElement("h1");
    title.textContent = `自選股清單 · ${filteredFavoriteStocks.length} 檔`;
    const timestamp = document.createElement("span");
    timestamp.textContent = `匯出時間：${exportedAt}`;
    header.append(kicker, title, timestamp);
    printable.append(header);
    const composition = document.createElement("section");
    composition.className = "watchlist-pdf-composition";
    const compositionTitle = document.createElement("h2");
    compositionTitle.textContent = "產業構成與佔比";
    const compositionNote = document.createElement("p");
    compositionNote.textContent = `${watchlistSourceFilter === "全部來源" ? "全部來源" : `來源：${watchlistSourceFilter}`} · 依目前佔比${sectorCompositionDirection === "desc" ? "高至低" : "低至高"}排列`;
    const compositionList = document.createElement("div");
    compositionList.className = "watchlist-pdf-sector-list";
    sortedWatchlistSectorComposition.forEach((item) => {
      const sectorItem = document.createElement("div");
      const sectorName = document.createElement("span");
      sectorName.textContent = `${item.sector} · ${item.count} 檔`;
      const sectorPercentage = document.createElement("b");
      sectorPercentage.textContent = `${item.percentage.toFixed(1)}%`;
      sectorItem.append(sectorName, sectorPercentage);
      compositionList.append(sectorItem);
    });
    composition.append(compositionTitle, compositionNote, compositionList);
    printable.append(composition);
    const listing = document.createElement("div");
    listing.className = "watchlist-pdf-list";
    filteredFavoriteStocks.forEach((stock, index) => {
      const item = document.createElement("article");
      const indexLabel = document.createElement("b");
      indexLabel.textContent = String(index + 1).padStart(2, "0");
      const copy = document.createElement("div");
      copy.className = "watchlist-pdf-copy";
      const ticker = document.createElement("strong");
      ticker.textContent = stock.ticker;
      const company = document.createElement("span");
      company.className = "watchlist-pdf-company";
      company.textContent = stock.company;
      const metadata = document.createElement("small");
      metadata.className = "watchlist-pdf-metadata";
      metadata.textContent = `來源策略：${sourceNameForTicker(stock.ticker)} · ${stock.sector}`;
      copy.append(ticker, company, metadata);
      item.append(indexLabel, copy);
      listing.append(item);
    });
    printable.append(listing);
    const disclaimer = document.createElement("p");
    disclaimer.className = "watchlist-pdf-disclaimer";
    disclaimer.textContent = "本清單僅彙整使用者於本裝置保存的自選標的，僅供研究與分析使用，不構成投資建議。";
    printable.append(disclaimer);
    document.body.appendChild(printable);
    try {
      const canvas = await html2canvas(printable, { backgroundColor: "#fcfaf4", scale: 2, useCORS: true, logging: false });
      const pdf = new jsPDF({ format: "a4", orientation: "portrait", unit: "pt" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 30;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;
      const renderedHeight = (canvas.height * printableWidth) / canvas.width;
      const image = canvas.toDataURL("image/png");
      for (let offset = 0; offset < renderedHeight; offset += printableHeight) {
        if (offset > 0) pdf.addPage();
        pdf.addImage(image, "PNG", margin, margin - offset, printableWidth, renderedHeight, undefined, "FAST");
      }
      pdf.save(`${buildWatchlistPdfFileName()}.pdf`);
    } finally {
      printable.remove();
    }
  }

  return (
    <div className="market-app">
      <aside className="research-rail" aria-label="Dashboard 導覽與篩選視角">
        <div>
          <a href="#top" className="brand-mark" aria-label="Signal Ledger 首頁">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img" focusable="false"><title>指南針訊號圖標</title><circle cx="14" cy="14" r="12" stroke="#c08b48" strokeWidth="1.5" /><path d="M8 18L12 12L16 15L20 8" stroke="#147B72" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /><circle cx="14" cy="14" r="1.6" fill="#147B72" /></svg>
            <span><strong>Signal Ledger</strong><small>MARKET SCREENING</small></span>
          </a>
          <div className="rail-divider" />
          <p className="rail-section-title">研究視角</p>
          <nav className="screen-nav">
            {screens.map((item, index) => (
              <button key={item.key} onClick={() => changeScreen(item.key)} className={`screen-nav-item ${activeScreen === item.key ? "selected" : ""}`}>
                <span className="nav-index">0{index + 1}</span>
                <span><strong>{item.name}</strong><small>{item.navLabel}</small></span>
              </button>
            ))}
          </nav>
        </div>
        <div className="rail-source">
          <div className="source-kicker"><Database size={14} /> 資料擷取</div>
          <p>Finviz Screener 的篩選快照，報價與組成可能因市場與來源更新而變動。</p>
          <span className="source-date">{screen.snapshotAt}</span>
        </div>
      </aside>

      <main id="top" className="data-stage">
        <header className="topline">
          <span className="live-indicator"><i /> 篩選快照</span>
          <div className="topline-right"><span>{screens.length} 組市場條件</span><span className="topline-dot">•</span><a href={screen.sourceUrl} target="_blank" rel="noreferrer">查看原始條件 <ArrowUpRight size={13} /></a><span className="topline-dot">•</span><span className="sync-status" data-role="finviz-sync-status" title={isLive ? "至少一組視角已由排程同步取得資料" : "資料庫尚無同步紀錄，目前顯示展示用靜態資料"}>{isLive ? `Finviz 同步：${lastSyncedAt ? formatPriceUpdatedAt(lastSyncedAt) : "—"}` : "Finviz 同步：尚未同步（展示資料）"}{staleScreenKeys.includes(activeScreen) && isLive ? " · 本視角待首次同步" : ""}</span><div className="price-refresh-control" aria-live="polite"><span className="price-refresh-status">股價更新：{formatPriceUpdatedAt(lastPriceUpdatedAt)}{priceRefreshError ? ` · ${priceRefreshError}` : ""}</span><button type="button" className="price-refresh-button" data-role="refresh-current-prices" onClick={refreshCurrentPrices} disabled={!priceHistoryInput.tickers.length || isPriceRefreshing} aria-label="更新目前股價"><RefreshCw size={13} className={isPriceRefreshing ? "is-spinning" : undefined} /><span>{isPriceRefreshing ? "更新中…" : "更新目前股價"}</span></button></div></div>
        </header>

        <section className="hero-panel" style={{ backgroundImage: "linear-gradient(90deg, rgba(13, 28, 48, .98) 0%, rgba(13, 28, 48, .93) 45%, rgba(13, 28, 48, .26) 100%)" }}>
          <div className="hero-copy"><p className="eyebrow copper-text">{screen.eyebrow}</p><h1 className={isDefensiveScreen ? "hero-title-defensive" : undefined}>{screen.name}</h1><p>{screen.note}</p></div>
          <div className="hero-signal"><span>本次訊號</span><strong>{screen.signal}</strong><div className="signal-line"><i /><i /><i /><i /><i /></div></div>
        </section>

        {isInsiderScreen ? <InsiderTradingView sectorData={insiderSectorData} sectorAxisMax={insiderSectorAxisMax} sectorDirection={insiderSectorCompositionDirection} onToggleSectorDirection={() => setInsiderSectorCompositionDirection((direction) => direction === "desc" ? "asc" : "desc")} watchlistTickers={watchlistTickers} onToggleWatchlist={(ticker) => toggleWatchlist(ticker, "內部人資訊")} /> : <>
        <section className="metrics-grid" aria-label="目前視角摘要">
          <StatCard label="符合條件" value={`${stats.sourceCount} 檔`} note={screen.loadedScope ?? "來源列出的篩選結果"} accent="teal" />
          <StatCard label="平均日變動" value={stats.averageChange === null ? "—" : `${stats.averageChange >= 0 ? "+" : ""}${stats.averageChange.toFixed(2)}%`} note={stats.averageChange === null ? "無符合標的，無法計算" : screen.loadedScope ?? "以名單中每檔變動率計算"} accent="copper" />
          <StatCard label="合計成交量" value={stats.stockCount ? formatVolume(stats.totalVolume) : "—"} note={stats.stockCount ? screen.loadedScope ?? "篩選列出的當日成交量" : "本次快照沒有符合標的"} accent="ink" />
          <StatCard label="合計市值" value={stats.stockCount ? formatMarketCap(stats.totalMarketCap) : "—"} note={stats.stockCount ? screen.loadedScope ?? "依來源顯示市值加總" : "本次快照沒有符合標的"} accent="teal" />
        </section>

        <section className="analysis-grid">
          <article className="filter-dossier">
            <div className="section-head"><div><p className="eyebrow">SCREEN CONFIGURATION</p><h2>篩選條件備忘</h2></div><SlidersHorizontal size={20} /></div>
            <div className="filter-chips">{screen.filters.map((filter) => <span key={filter}><Check size={12} /> {filter}</span>)}</div>
            <div className={`risk-note ${activeScreen === "microShort" ? "risk" : ""}`}><CircleAlert size={17} /><p><strong>解讀提示：</strong>{screen.caution}</p></div>
            <a className="source-button" href={screen.sourceUrl} target="_blank" rel="noreferrer">開啟 Finviz 原始篩選 <ExternalLink size={14} /></a>
          </article>
          <article className="sector-panel">
            <div className="section-head"><div><p className="eyebrow">COMPOSITION</p><h2>產業構成</h2></div><div className="sector-panel-actions"><span className="small-data">{sectorData.length} 類</span><button type="button" className="sector-sort-button" data-role="screen-sector-sort" onClick={() => setSectorCompositionDirection((direction) => direction === "desc" ? "asc" : "desc")} aria-label={`目前產業佔比由${sectorCompositionDirection === "desc" ? "高至低" : "低至高"}排序，點擊切換`}><ArrowUpDown size={12} />{sectorCompositionDirection === "desc" ? "高→低" : "低→高"}</button></div></div>
            {sectorData.length ? <div className="sector-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={sectorData} layout="vertical" margin={{ top: 3, right: 54, bottom: 3, left: 4 }}><XAxis type="number" hide domain={[0, sectorAxisMax]} /><YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} tick={{ fill: "#626a67", fontSize: 11, fontFamily: "Noto Sans TC" }} /><Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={18}>{sectorData.map((entry, index) => <Cell key={entry.name} fill={index === 0 ? "#147B72" : "#c08b48"} />)}<LabelList dataKey="percentageLabel" position="right" fill="#33444a" fontSize={11} fontFamily="Noto Sans TC" /></Bar></BarChart></ResponsiveContainer></div> : <div className="sector-empty"><Layers size={19} /><p>本次快照無符合結果</p></div>}
          </article>
        </section>

        <section className="insight-strip">
          <div className="insight-art" style={{ backgroundImage: "linear-gradient(90deg, rgba(12, 28, 47, .94), rgba(12, 28, 47, .28)), radial-gradient(circle at 70% 50%, rgba(20,123,114,.35) 0%, rgba(20,123,114,0) 60%)" }} />
          {leadingMove ? <><div className="insight-copy"><p className="eyebrow copper-text">{isTopLosersScreen ? "SHARPEST DROP" : "LEADING MOVE"}</p><h2>{leadingMove.ticker} <span>{leadingMove.company}</span></h2><p>在此視角中，該股以 <strong>{leadingMove.change >= 0 ? "+" : ""}{leadingMove.change.toFixed(2)}%</strong> 的單日變動{isTopLosersScreen ? "跌幅最大" : "居首"}；目前價格 {formatUsd(leadingMove.price)}，來源列示成交量 {formatVolume(leadingMove.volume)}。</p></div><div className="insight-metric"><Activity size={19} /><strong>{leadingMove.change >= 0 ? "+" : ""}{leadingMove.change.toFixed(2)}%</strong><small>日變動</small></div></> : <><div className="insight-copy"><p className="eyebrow copper-text">NO CURRENT MATCH</p><h2>目前沒有符合結果</h2><p>此 Finviz 快照的條件交集為 0 檔。您仍可開啟原始篩選條件，於市場資料更新後重新核對。</p></div><div className="insight-metric"><CircleAlert size={19} /><strong>0 檔</strong><small>符合條件</small></div></>}
        </section>

        <section className="universe-section" aria-label="股票名單">
          <div className="universe-header"><div><p className="eyebrow">SCREEN UNIVERSE</p><h2>符合條件的股票名單</h2></div><p>目前顯示 <strong>{renderedRankedStocks.length}</strong> / {visibleStocks.length} 檔{screen.snapshotTotal ? `（原始快照共 ${stats.sourceCount} 檔）` : ""}</p></div>
          {stats.stockCount > 0 ? <><div className="table-controls">
            <label className="search-control"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋代碼、公司或產業" aria-label="搜尋股票名單" /></label>
            <label className="select-control"><span>產業</span><select value={sector} onChange={(event) => setSector(event.target.value)}>{sectors.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={15} /></label>
            <div className="mobile-sort-control" role="group" aria-label="股票名單排序">
              <span className="mobile-sort-label"><ArrowUpDown size={15} /> 排序</span>
              <label className="mobile-sort-select"><select value={sortKey} onChange={(event) => { setSortKey(event.target.value as SortKey); setSortDirection("desc"); }} aria-label="排序欄位"><option value="change">漲跌幅</option><option value="price">股價</option><option value="pe">本益比</option><option value="marketCapBn">市值</option></select><ChevronDown size={15} /></label>
              <button type="button" className="mobile-sort-direction" onClick={() => setSortDirection((direction) => direction === "asc" ? "desc" : "asc")} aria-label={`目前${sortDirection === "desc" ? "由高至低" : "由低至高"}，點擊切換排序方向`}><ArrowUpDown size={14} /><span>{sortDirection === "desc" ? "高→低" : "低→高"}</span></button>
            </div>
          </div>{isDefensiveScreen && <div className="defensive-sector-quick-filter" role="group" aria-label="防禦型產業快速篩選"><span>防禦產業</span><button type="button" className={sector === "全部產業" ? "active" : ""} onClick={() => setSector("全部產業")}>全部</button>{DEFENSIVE_QUICK_SECTORS.map((option) => <button key={option.value} type="button" className={sector === option.value ? "active" : ""} onClick={() => setSector(option.value)}>{option.label}</button>)}</div>}<div className="table-shell"><table><thead><tr><th>排名</th><th><SortableHeading label="代碼" column="ticker" active={sortKey} direction={sortDirection} onSort={handleSort} /></th><th>公司／產業</th><th><SortableHeading label="市值" column="marketCapBn" active={sortKey} direction={sortDirection} onSort={handleSort} /></th><th><SortableHeading label="本益比" column="pe" active={sortKey} direction={sortDirection} onSort={handleSort} /></th><th><SortableHeading label="股價" column="price" active={sortKey} direction={sortDirection} onSort={handleSort} /></th><th><SortableHeading label="漲跌幅" column="change" active={sortKey} direction={sortDirection} onSort={handleSort} /></th><th><SortableHeading label="成交量" column="volume" active={sortKey} direction={sortDirection} onSort={handleSort} /></th><th>AI 摘要</th><th /></tr></thead><tbody>{renderedRankedStocks.map(({ stock, rank }) => <StockRow key={stock.ticker} stock={stock} rank={rank} history={miniPriceHistories.data?.histories[stock.ticker]} currentPrice={currentPrices.get(stock.ticker)} isHistoryLoading={miniPriceHistories.isLoading} isExpanded={expandedTicker === stock.ticker} isFavorite={watchlistTickers.includes(stock.ticker)} onToggle={() => setExpandedTicker((current) => current === stock.ticker ? null : stock.ticker)} onToggleWatchlist={() => toggleWatchlist(stock, screen.shortName)} onSummary={() => requestSummary(stock)} />)}</tbody></table>{visibleStocks.length === 0 && <div className="empty-state">此搜尋或產業條件下沒有符合結果。</div>}</div>{isDefensiveScreen && visibleStocks.length > 0 && <nav className="defensive-pagination" aria-label="防禦型股票清單分頁"><p>第 {activeDefensivePage} / {defensivePageTotal} 頁 · 每頁 {DEFENSIVE_PAGE_SIZE} 檔迷你走勢</p><div><button type="button" onClick={() => setDefensivePage((page) => Math.max(1, page - 1))} disabled={activeDefensivePage === 1} aria-label="上一頁"><ChevronLeft size={15} /> 上一頁</button><span aria-current="page">{activeDefensivePage} / {defensivePageTotal}</span><button type="button" onClick={() => setDefensivePage((page) => Math.min(defensivePageTotal, page + 1))} disabled={activeDefensivePage === defensivePageTotal} aria-label="下一頁">下一頁 <ChevronRight size={15} /></button></div></nav>}</> : <div className="zero-result-card"><CircleAlert size={19} /><div><strong>此策略本次快照為 0 檔</strong><p>目前沒有股票同時符合全部條件。市場資料更新後，可由上方來源連結重新核對。</p></div></div>}
        </section>
        </>}
        <footer className="dashboard-footer"><div><Layers size={15} /> <span>資料來源：Finviz Screener · {isInsiderScreen ? "Finviz Insider Trading · 買入與賣出 Form 4 快照" : `Finviz Screener · ${screens.length} 組 URL 均可於上方原始條件連結核對。`}</span></div><p>僅供研究與分析使用，不構成個人化投資建議。</p></footer>
        <section className="investment-disclaimer" aria-label="投資警語">
          <div className="disclaimer-heading"><CircleAlert size={18} /><div><p className="eyebrow">IMPORTANT NOTICE</p><h2>投資警語</h2></div></div>
          <p>本 Dashboard 所呈現的篩選條件、報價、成交量與統計內容，僅供一般資訊與研究用途，不構成個人化投資建議、買賣邀約或任何投資保證。投資有風險，價格、成交量與流動性可能快速變動。</p>
          <p>請依自身投資目標、財務狀況與風險承受能力獨立判斷；如有需要，請諮詢合格的財務、稅務或法律專業人士。市場資料可能延遲、不完整或因來源更新而變動，應以原始資料來源為準。</p>
        </section>
        <section id="watchlist-panel" className={`watchlist-panel watchlist-bottom ${isWatchlistOpen ? "is-open" : ""}`} aria-label="自選股清單">
          <header className="watchlist-panel-head"><div><p className="eyebrow">PERSONAL WATCHLIST</p><h2>自選股 · {favoriteStocks.length} 檔</h2><p className="watchlist-subtitle">點擊開啟自選股，即可查看本裝置上次保存的追蹤清單。</p></div><div className="watchlist-panel-actions"><button type="button" className="watchlist-open-button" data-role="watchlist-open" onClick={() => setIsWatchlistOpen((open) => !open)} aria-expanded={isWatchlistOpen} aria-controls="watchlist-content"><span>{isWatchlistOpen ? "收合清單" : "開啟自選股"}</span><ChevronDown size={14} /></button><button type="button" className="watchlist-pdf-button" data-role="watchlist-pdf-export" onClick={exportWatchlistPdf} disabled={!favoriteStocks.length || !isWatchlistOpen} aria-label="匯出自選股 PDF"><Download size={14} /><span>匯出 PDF</span></button><button type="button" className="watchlist-csv-button" data-role="watchlist-csv-export" onClick={exportWatchlistCsv} disabled={!filteredFavoriteStocks.length || !isWatchlistOpen} aria-label="匯出目前自選股 CSV"><Download size={14} /><span>匯出 CSV</span></button><button type="button" className="watchlist-clear-button" data-role="watchlist-clear" onClick={() => setIsWatchlistClearDialogOpen(true)} disabled={!favoriteStocks.length} aria-label={`清空 ${favoriteStocks.length} 檔自選股`}><Trash2 size={14} /><span>清空</span></button></div></header>
          {isWatchlistOpen && <div id="watchlist-content" className="watchlist-content">{favoriteStocks.length ? <>
            <section className="watchlist-source-filter" aria-label="依加入來源篩選自選股"><p><Bookmark size={13} /> 加入來源</p><div role="group" aria-label="自選股加入來源"><button type="button" data-role="watchlist-source-all" className={watchlistSourceFilter === "全部來源" ? "active" : ""} onClick={() => setWatchlistSourceFilter("全部來源")}>全部 <span>{favoriteStocks.length}</span></button>{watchlistSourceOptions.map((source) => <button type="button" key={source} data-role={`watchlist-source-${source}`} className={watchlistSourceFilter === source ? "active" : ""} onClick={() => setWatchlistSourceFilter(source)}>{source} <span>{favoriteStocks.filter((stock) => sourceNameForTicker(stock.ticker) === source).length}</span></button>)}</div></section>
            <section className="watchlist-sector-panel sector-panel" aria-label="自選股產業構成">
              <div className="section-head"><div><p className="eyebrow">COMPOSITION</p><h2>產業構成</h2></div><div className="sector-panel-actions"><span className="small-data">{watchlistSectorData.length} 類</span><button type="button" className="sector-sort-button" data-role="watchlist-sector-sort" onClick={() => setSectorCompositionDirection((direction) => direction === "desc" ? "asc" : "desc")} aria-label={`目前自選股產業佔比由${sectorCompositionDirection === "desc" ? "高至低" : "低至高"}排序，點擊切換`}><ArrowUpDown size={12} />{sectorCompositionDirection === "desc" ? "高→低" : "低→高"}</button></div></div>
              <div className="sector-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={watchlistSectorData} layout="vertical" margin={{ top: 3, right: 54, bottom: 3, left: 4 }}><XAxis type="number" hide domain={[0, watchlistSectorAxisMax]} /><YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} tick={{ fill: "#626a67", fontSize: 11, fontFamily: "Noto Sans TC" }} /><Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={18}>{watchlistSectorData.map((entry, index) => <Cell key={entry.name} fill={index === 0 ? "#147B72" : "#c08b48"} />)}<LabelList dataKey="percentageLabel" position="right" fill="#33444a" fontSize={11} fontFamily="Noto Sans TC" /></Bar></BarChart></ResponsiveContainer></div>
            </section>
            {filteredFavoriteStocks.length ? <div className="watchlist-grid">{filteredFavoriteStocks.map((stock) => <article className="watchlist-stock" key={stock.ticker}><div><strong>{stock.ticker}</strong><span>{stock.company}</span><small>來源策略：{sourceNameForTicker(stock.ticker)} · {stock.sector}</small></div><button type="button" className="watchlist-panel-remove" onClick={() => toggleWatchlist(stock)} aria-label={`從自選股移除 ${stock.ticker}`}><X size={14} /></button></article>)}</div> : <p className="watchlist-empty">此來源目前沒有自選股。</p>}
          </> : <p className="watchlist-empty">尚未加入自選股。請在任一股票卡最右側點擊「＋」，即可建立跨策略追蹤清單。</p>}</div>}
        </section>
      </main>
      <Dialog open={Boolean(summaryStock)} onOpenChange={(open) => !open && setSummaryStock(null)}>
        <DialogContent className="ai-summary-dialog" aria-describedby="ai-summary-description">
          <DialogHeader>
            <p className="eyebrow copper-text">AI SNAPSHOT BRIEF</p>
            <DialogTitle>{summaryStock?.ticker} · {summaryStock?.company}</DialogTitle>
            <DialogDescription id="ai-summary-description" className="ai-summary-boundary">依目前 Dashboard 的 Finviz 篩選快照與欄位生成；不會補述未提供的財報、新聞或技術指標。</DialogDescription>
          </DialogHeader>
          {stockSummary.isPending && <div className="ai-summary-loading"><Loader2 size={22} /><p>正在整理篩選快照與技術面訊號…</p></div>}
          {stockSummary.isError && <div className="ai-summary-error"><CircleAlert size={18} /><p>暫時無法產生摘要，請稍後再試。</p></div>}
          {summary && <><div className="ai-summary-dialog-scroll"><div ref={summaryExportRef} className="ai-summary-export-document" data-role="ai-summary-export-content"><header className="ai-summary-export-title"><p>Signal Ledger · AI 快照摘要</p><h1>{summaryStock?.ticker} · {summaryStock?.company}</h1><span>{summary.dataBasis}</span></header><p className="ai-summary-export-boundary">資料邊界：不會補述未提供的財報、新聞或技術指標。</p>
            <div className="ai-summary-content">
            <section><h3>營運／篩選亮點</h3><ul>{summary.operatingHighlights.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><h3>技術面快照</h3><ul>{summary.technicalRead.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section className="ai-risk"><h3>限制與風險</h3><p>{summary.riskNote}</p></section>
            <div className="ai-data-basis"><span>{summary.isFallback ? "快照備援摘要" : "AI 快照摘要"}</span><p>{summary.dataBasis}</p><a href={summary.sourceUrl} target="_blank" rel="noreferrer">查看原始篩選資料 <ArrowUpRight size={13} /></a></div>
            </div><p className="ai-summary-export-disclaimer">僅供研究與分析使用，不構成個人化投資建議、買賣邀約或任何投資保證。</p></div></div><label className="ai-summary-filename"><span>PDF 檔名</span><input data-role="ai-summary-pdf-filename" value={summaryFileName} onChange={(event) => setSummaryFileName(event.target.value)} placeholder="輸入自訂檔名" aria-label="AI 摘要 PDF 檔名" /></label><button type="button" className="ai-summary-pdf" data-role="ai-summary-pdf-export" onClick={exportSummaryPdf} disabled={isSummaryExporting}><Download size={15} />{isSummaryExporting ? "正在產生 PDF…" : "匯出 AI 摘要與圖表 PDF"}</button>{summaryExportMessage && <p className="ai-summary-export-message" aria-live="polite">{summaryExportMessage}</p>}</>}
        </DialogContent>
      </Dialog>
      <AlertDialog open={isWatchlistClearDialogOpen} onOpenChange={setIsWatchlistClearDialogOpen}>
        <AlertDialogContent className="border-[#d9c1b8] bg-[#fcfaf4] text-[#203c42]">
          <AlertDialogHeader>
            <p className="eyebrow copper-text">CLEAR WATCHLIST</p>
            <AlertDialogTitle>清空自選股？</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[#65736d]">將移除本機保存的 {favoriteStocks.length} 檔自選股，且無法復原。個股篩選與其他 Dashboard 設定不會受影響。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>保留清單</AlertDialogCancel>
            <AlertDialogAction data-role="watchlist-clear-confirm" className="bg-[#a15340] text-white hover:bg-[#8c3d2c]" onClick={clearWatchlist}>確認清空</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <nav className="mobile-screen-switcher" aria-label="快速切換篩選視角">
        {screens.map((item) => (
          <button key={item.key} type="button" onClick={() => changeScreen(item.key)} className={activeScreen === item.key ? "selected" : ""}>
            <span>{item.key === "qualityMomentum" ? <Activity size={15} /> : item.key === "insiderTrading" ? <Landmark size={15} /> : <Layers size={15} />}</span>
            <strong>{item.name}</strong>
            <small>{activeScreen === item.key ? "已選擇" : "切換"}</small>
          </button>
        ))}
        <button type="button" className="mobile-watchlist-switcher" data-role="mobile-watchlist-open" onClick={openWatchlistFromSwitcher} aria-label={`開啟自選股，目前 ${favoriteStocks.length} 檔`}>
          <span><Bookmark size={15} /></span>
          <strong>自選股</strong>
          <small>{favoriteStocks.length} 檔 · 開啟</small>
        </button>
      </nav>
    </div>
  );
}

function MiniCandlestick({ ticker, history, isLoading }: { ticker: string; history?: MiniPriceHistory; isLoading: boolean }) {
  const points = getMiniCandlePoints(history?.points ?? [], MINI_CANDLE_POINT_LIMIT);
  const [inspectedIndex, setInspectedIndex] = useState<number | null>(null);
  if (points.length < 2) return <span className={`mini-price-trend ${isLoading ? "loading" : "unavailable"}`} aria-label={`${ticker} 近 30 日走勢${isLoading ? "載入中" : "暫時無法取得"}`}><i /></span>;

  const geometry = buildMiniCandleGeometry(points);
  const firstClose = points[0].close;
  const lastClose = points.at(-1)?.close ?? firstClose;
  const isUp = lastClose >= firstClose;
  const direction = lastClose === firstClose ? "持平" : isUp ? "上升" : "下降";
  const colorFor = (isRising: boolean) => isRising ? "#147b72" : "#a15442";
  const candleBandWidth = geometry.width / points.length;
  const formatMiniDate = (timestamp: number) => new Date(timestamp * 1000).toLocaleDateString("zh-TW", { year: "numeric", month: "numeric", day: "numeric" });
  const formatMiniPoint = (point: PricePoint) => `${formatMiniDate(point.timestamp)}：開 ${formatUsd(point.open)}、高 ${formatUsd(point.high)}、低 ${formatUsd(point.low)}、收 ${formatUsd(point.close)}、量 ${formatVolume(point.volume)}`;
  const inspectedPoint = inspectedIndex === null ? null : points[inspectedIndex];

  return (
    <span className={`mini-price-trend mini-candlestick ${isUp ? "up" : "down"}`} title={`${ticker} 近 30 日蠟燭圖與成交量 · ${direction} · 將游標移至蠟燭查閱 OHLCV`} aria-label={`${ticker} 近 30 日蠟燭圖與成交量，${direction}，最高 ${formatUsd(geometry.chartHigh)}，最低 ${formatUsd(geometry.chartLow)}`}>
      <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none" role="img" aria-label={`${ticker} 近 30 日蠟燭圖與成交量`}>
        <line className="volume-divider" x1="0" x2={geometry.width} y1={geometry.volumeTop - 2} y2={geometry.volumeTop - 2} />
        {geometry.candles.map((candle, index) => {
          const color = colorFor(candle.isUp);
          const point = points[index];
          const pointLabel = formatMiniPoint(point);
          const isInspected = inspectedIndex === index;
          return (
            <g key={candle.timestamp} data-role="mini-candle">
              <line data-role="mini-candle-wick" x1={candle.x} x2={candle.x} y1={candle.wickTop} y2={candle.wickBottom} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <rect data-role="mini-candle-body" x={candle.x - geometry.bodyWidth / 2} y={candle.bodyTop} width={geometry.bodyWidth} height={candle.bodyHeight} fill={color} rx="0.4" />
              <rect data-role="mini-volume-bar" x={candle.x - geometry.bodyWidth / 2} y={candle.volumeY} width={geometry.bodyWidth} height={candle.volumeHeight} fill={color} opacity="0.52" rx="0.35" />
              <rect data-role="mini-candle-hit" className={isInspected ? "is-inspected" : undefined} x={candle.x - candleBandWidth / 2} y="0" width={candleBandWidth} height={geometry.height} fill="transparent" pointerEvents="all" role="button" tabIndex={0} aria-label={pointLabel} onMouseEnter={() => setInspectedIndex(index)} onFocus={() => setInspectedIndex(index)} onMouseLeave={() => setInspectedIndex(null)} onBlur={() => setInspectedIndex(null)}><title>{pointLabel}</title></rect>
            </g>
          );
        })}
        <g className="extreme-label high" pointerEvents="none">
          <text data-role="mini-high-label" x={geometry.width - 2} y={geometry.priceTop + 2} textAnchor="end">H {formatUsd(geometry.chartHigh)}</text>
        </g>
        <g className="extreme-label low" pointerEvents="none">
          <text data-role="mini-low-label" x={geometry.width - 2} y={geometry.priceBottom + 8} textAnchor="end">L {formatUsd(geometry.chartLow)}</text>
        </g>
      </svg>
      {inspectedPoint && <span className="mini-candle-tooltip" role="status" aria-live="polite"><strong>{ticker} · {formatMiniDate(inspectedPoint.timestamp)}</strong><span><b>開</b>{formatUsd(inspectedPoint.open)} <b>高</b>{formatUsd(inspectedPoint.high)}</span><span><b>低</b>{formatUsd(inspectedPoint.low)} <b>收</b>{formatUsd(inspectedPoint.close)}</span><span><b>量</b>{formatVolume(inspectedPoint.volume)}</span></span>}
    </span>
  );
}

function DetailPriceChart({ ticker }: { ticker: string }) {
  const { data: history, isLoading, isError } = trpc.priceHistory.get.useQuery({ ticker, range: "6mo" }, { staleTime: 15 * 60 * 1000, retry: 1 });
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
  const [visibleMovingAveragePeriods, setVisibleMovingAveragePeriods] = useState<MovingAveragePeriod[]>(() => parseVisibleMovingAveragePeriods(window.localStorage.getItem(MOVING_AVERAGE_VISIBILITY_STORAGE_KEY)));

  useEffect(() => {
    window.localStorage.setItem(MOVING_AVERAGE_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleMovingAveragePeriods));
  }, [visibleMovingAveragePeriods]);

  if (isLoading) return <section className="detail-price-chart detail-price-chart-state"><Loader2 size={18} /><span>正在載入近 6 個月日線與量能…</span></section>;
  if (isError || !history) return <section className="detail-price-chart detail-price-chart-state error"><CircleAlert size={17} /><span>長週期價格資料暫時無法取得。</span></section>;

  const { points } = history;
  const highPoint = points.reduce((highest, point) => point.high > highest.high ? point : highest);
  const lowPoint = points.reduce((lowest, point) => point.low < lowest.low ? point : lowest);
  const chartLow = lowPoint.low;
  const chartHigh = highPoint.high;
  const chartRange = Math.max(chartHigh - chartLow, Math.abs(chartHigh) * 0.01, 0.01);
  const chartWidth = 840;
  const chartHeight = 286;
  const priceTop = 22;
  const priceBottom = 185;
  const volumeTop = 214;
  const volumeBottom = 260;
  const xStep = chartWidth / points.length;
  const bodyWidth = Math.max(1.8, Math.min(5, xStep * 0.64));
  const y = (value: number) => priceTop + ((chartHigh - value) / chartRange) * (priceBottom - priceTop);
  const maxVolume = Math.max(...points.map((point) => point.volume), 1);
  const volumeY = (value: number) => volumeBottom - (value / maxVolume) * (volumeBottom - volumeTop);
  const dateStep = Math.max(1, Math.ceil(points.length / 6));
  const formatDate = (timestamp: number) => new Date(timestamp * 1000).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", year: "numeric" });
  const movingAverages = MOVING_AVERAGE_PRESENTATIONS.map((definition) => ({ ...definition, values: calculateSimpleMovingAverage(points.map((point) => point.close), definition.period) }));
  const ma30 = calculateSimpleMovingAverage(points.map((point) => point.close), 30);
  const maSummary = summarizeLatestMovingAverage(ma30);
  const selectedIndex = (() => { const index = selectedTimestamp === null ? points.length - 1 : points.findIndex((point) => point.timestamp === selectedTimestamp); return index < 0 ? points.length - 1 : index; })();
  const selectedPoint = points[selectedIndex];
  const selectedMa = ma30[selectedIndex];
  const makeMovingAveragePath = (values: Array<number | null>) => values.reduce<string>((path, average, index) => {
      if (average === null) return path;
      const x = (index + 0.5) * xStep;
      return `${path}${path ? " L" : "M"}${x.toFixed(2)} ${y(average).toFixed(2)}`;
    }, "");
  const movingAveragePaths = movingAverages.map((average) => ({ ...average, path: makeMovingAveragePath(average.values) }));
  const slopeLabel = maSummary.direction === "up" ? "上行" : maSummary.direction === "down" ? "下行" : maSummary.direction === "flat" ? "持平" : "資料不足";
  const selectCandle = (timestamp: number) => setSelectedTimestamp(timestamp);

  return <section className="detail-price-chart" data-role="pdf-detail-chart" data-ticker={ticker} aria-label={`${ticker} ${history.rangeLabel}蠟燭圖、成交量與 MA10、MA30、MA60、MA100`}>
    <div className="detail-price-chart-head"><div><span>長週期價格與量能</span><strong>{history.rangeLabel}</strong></div><div className="detail-extremes"><span className="high">H {formatUsd(highPoint.high)}</span><span className="low">L {formatUsd(lowPoint.low)}</span></div></div>
    <div className="detail-ma-control-row"><ToggleGroup type="multiple" variant="outline" size="sm" className="detail-ma-controls" aria-label="顯示或隱藏均線" value={visibleMovingAveragePeriods.map(String)} onValueChange={(values) => setVisibleMovingAveragePeriods(getVisibleMovingAveragePeriods(values.map(Number)))}>{MOVING_AVERAGE_PRESENTATIONS.map((average) => <ToggleGroupItem key={average.label} data-role={`detail-${average.label.toLowerCase()}-toggle`} className="detail-ma-toggle" style={{ "--ma-color": average.color } as CSSProperties} value={String(average.period)} aria-label={`${average.label}${visibleMovingAveragePeriods.includes(average.period) ? "目前顯示，點擊隱藏" : "目前隱藏，點擊顯示"}`}><i />{average.label}</ToggleGroupItem>)}</ToggleGroup><div className="detail-ma-quick-actions" role="group" aria-label="均線快速操作"><button type="button" data-role="detail-ma-show-all" onClick={() => setVisibleMovingAveragePeriods(getAllMovingAveragePeriods())} disabled={visibleMovingAveragePeriods.length === MOVING_AVERAGE_PRESENTATIONS.length}>全部顯示</button><button type="button" data-role="detail-ma-hide-all" onClick={() => setVisibleMovingAveragePeriods([])} disabled={visibleMovingAveragePeriods.length === 0}>全部隱藏</button></div></div>
    <div className="detail-ma-summary" aria-label="MA30 摘要"><span>MA30 現值</span><strong data-role="ma30-current">{maSummary.current === null ? "—" : formatUsd(maSummary.current)}</strong><span>日斜率</span><strong data-role="ma30-slope" className={`ma-slope ${maSummary.direction}`}>{maSummary.changePercent === null ? "資料不足" : `${slopeLabel} ${maSummary.changePercent >= 0 ? "+" : ""}${maSummary.changePercent.toFixed(2)}%`}</strong><small>以最近兩個有效 MA30 值比較</small></div>
    <div className="detail-candle-inspector" aria-live="polite"><div><span>單日 OHLCV</span><strong data-role="selected-candle-date">{formatDate(selectedPoint.timestamp)}</strong></div><dl><div className="detail-reading-row detail-price-reading-row" data-role="detail-price-readings"><dt className="detail-reading-row-title">股價</dt><div className="detail-reading-row-values"><div><dt>開</dt><dd>{formatUsd(selectedPoint.open)}</dd></div><div><dt>高</dt><dd>{formatUsd(selectedPoint.high)}</dd></div><div><dt>低</dt><dd>{formatUsd(selectedPoint.low)}</dd></div><div><dt>收</dt><dd data-role="detail-close-value" className="detail-close-value">{formatUsd(selectedPoint.close)}</dd></div><div><dt>量</dt><dd>{formatVolume(selectedPoint.volume)}</dd></div></div></div><div className="detail-reading-row detail-ma-reading-row" data-role="detail-moving-average-readings"><dt className="detail-reading-row-title">均線</dt><div className="detail-reading-row-values">{movingAverages.map((average) => <div key={average.label} className="detail-ma-reading" style={{ "--ma-color": average.color } as CSSProperties}><dt>{average.label}</dt><dd data-role={`selected-${average.label.toLowerCase()}`}>{average.values[selectedIndex] === null ? "—" : formatUsd(average.values[selectedIndex]!)}</dd></div>)}</div></div></dl><p>點按任一蠟燭或以鍵盤 Enter／空白鍵查閱該日資料。</p></div>
    <div className="detail-price-chart-canvas"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img"><line className="detail-volume-divider" x1="0" x2={chartWidth} y1="200" y2="200" />{points.map((point, index) => { const rising = point.close >= point.open; const color = rising ? "#147b72" : "#a15442"; const x = (index + 0.5) * xStep; const bodyTop = Math.min(y(point.open), y(point.close)); const bodyHeight = Math.max(1.3, Math.abs(y(point.open) - y(point.close))); const showDate = index === 0 || index === points.length - 1 || index % dateStep === 0; const dateX = index === 0 ? 4 : index === points.length - 1 ? chartWidth - 4 : x; const dateAnchor = index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"; const isSelected = selectedPoint.timestamp === point.timestamp; return <g key={point.timestamp}><line data-role="detail-candle-wick" x1={x} x2={x} y1={y(point.high)} y2={y(point.low)} stroke={isSelected ? "#7c3aed" : color} strokeWidth={isSelected ? "1.8" : "1"} vectorEffect="non-scaling-stroke" /><rect data-role="detail-candle-body" x={x - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} stroke={isSelected ? "#7c3aed" : "none"} strokeWidth={isSelected ? "1.5" : undefined} rx="0.4" /><rect data-role="detail-volume-bar" x={x - bodyWidth / 2} y={volumeY(point.volume)} width={bodyWidth} height={Math.max(1, volumeBottom - volumeY(point.volume))} fill={color} opacity="0.52" rx="0.35" />{showDate && <text className="detail-date-label" x={dateX} y="274" textAnchor={dateAnchor}>{formatDate(point.timestamp)}</text>}<rect data-role="detail-candle-hit" className="detail-candle-hit" x={index * xStep} y={0} width={xStep} height={volumeBottom} fill="transparent" role="button" tabIndex={0} aria-label={`${formatDate(point.timestamp)}：開 ${formatUsd(point.open)}、最高 ${formatUsd(point.high)}、最低 ${formatUsd(point.low)}、收 ${formatUsd(point.close)}、成交量 ${formatVolume(point.volume)}`} onClick={() => selectCandle(point.timestamp)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectCandle(point.timestamp); } }} /></g>; })}{movingAveragePaths.map((average) => visibleMovingAveragePeriods.includes(average.period) && average.path && <path key={average.label} data-role={`detail-${average.label.toLowerCase()}-line`} className={`detail-ma-line detail-${average.label.toLowerCase()}-line`} d={average.path} fill="none" pointerEvents="none" vectorEffect="non-scaling-stroke" />)}<g className="detail-extreme-line high" pointerEvents="none"><line x1="0" x2={chartWidth} y1={y(highPoint.high)} y2={y(highPoint.high)} /><text data-role="detail-high-label" x={chartWidth - 6} y={Math.max(17, y(highPoint.high) - 5)} textAnchor="end">最高 {formatUsd(highPoint.high)}</text></g><g className="detail-extreme-line low" pointerEvents="none"><line x1="0" x2={chartWidth} y1={y(lowPoint.low)} y2={y(lowPoint.low)} /><text data-role="detail-low-label" x={chartWidth - 6} y={Math.min(priceBottom - 4, y(lowPoint.low) + 13)} textAnchor="end">最低 {formatUsd(lowPoint.low)}</text></g></svg></div>
    <DetailTechnicalIndicators points={points} selectedTimestamp={selectedPoint.timestamp} onSelectTimestamp={selectCandle} />
    <p className="detail-price-source"><span>成交量長條依日線收漲／收跌著色；均線為 MA10／MA30／MA60／MA100；MACD(12、26、9) 與 RSI(6) 均以日收盤價計算。</span><a href={history.sourceUrl} target="_blank" rel="noreferrer">{history.sourceName} · {new Date(history.fetchedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} 擷取 <ArrowUpRight size={11} /></a></p>
  </section>;
}

function DetailTechnicalIndicators({ points, selectedTimestamp, onSelectTimestamp }: { points: PricePoint[]; selectedTimestamp: number; onSelectTimestamp: (timestamp: number) => void }) {
  const closes = points.map((point) => point.close);
  const macd = calculateMacd(closes);
  const rsi6 = calculateRsi(closes, 6);
  const latestMacd = macd.at(-1) ?? { macd: null, signal: null, histogram: null };
  const latestRsi = rsi6.at(-1) ?? null;
  const width = 840;
  const macdHeight = 108;
  const rsiHeight = 78;
  const xStep = width / points.length;
  const drawableMacd = macd.flatMap((value) => [value.macd, value.signal, value.histogram].filter((item): item is number => item !== null));
  const macdLimit = Math.max(...drawableMacd.map(Math.abs), 0.1) * 1.18;
  const macdY = (value: number) => 48 - (value / macdLimit) * 36;
  const rsiY = (value: number) => 8 + ((100 - value) / 100) * 54;
  const makePath = (values: Array<number | null>, y: (value: number) => number) => values.reduce<string>((path, value, index) => value === null ? path : `${path}${path ? " L" : "M"}${((index + 0.5) * xStep).toFixed(2)} ${y(value).toFixed(2)}`, "");
  const macdPath = makePath(macd.map((value) => value.macd), macdY);
  const signalPath = makePath(macd.map((value) => value.signal), macdY);
  const rsiPath = makePath(rsi6, rsiY);
  const display = (value: number | null) => value === null ? "—" : value.toFixed(2);
  const formatIndicatorDate = (timestamp: number) => new Date(timestamp * 1000).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", year: "numeric" });
  const selectedIndex = Math.max(0, points.findIndex((point) => point.timestamp === selectedTimestamp));
  const selectedPoint = points[selectedIndex];
  const selectedMacd = macd[selectedIndex] ?? { macd: null, signal: null, histogram: null };
  const selectedRsi = rsi6[selectedIndex] ?? null;
  const selectedX = (selectedIndex + 0.5) * xStep;
  const histogramColor = (value: number | null) => value === null ? "transparent" : value >= 0 ? "#147b72" : "#a15442";
  const rsiZone = getRsiZone(latestRsi);
  const rsiAlertText = rsiZone === "overbought" ? "超買提醒 · RSI 高於 80" : rsiZone === "oversold" ? "超賣提醒 · RSI 低於 20" : rsiZone === "neutral" ? "中性區間 · 未觸發極端提醒" : "資料不足 · 尚無 RSI 值";
  const latestExtremeEntry = findLatestRsiExtremeEntry(rsi6);
  const latestExtremeDate = latestExtremeEntry ? formatIndicatorDate(points[latestExtremeEntry.index].timestamp) : null;
  const isExtremeStillActive = latestExtremeEntry?.zone === rsiZone;
  const extremeEntryText = latestExtremeEntry
    ? `${latestExtremeEntry.zone === "overbought" ? "超買" : "超賣"}首次進入：${latestExtremeDate} · ${isExtremeStillActive ? "目前仍在此區" : "目前已離開該區"}`
    : "近 6 個月尚未進入超買或超賣區";

  return <section className="detail-indicators" aria-label="MACD 與 RSI 技術指標">
    <div className="indicator-panel macd-panel"><header><div><span>趨勢動能</span><strong>MACD <small>12 · 26 · 9</small></strong></div><p><b className="macd-line-key">MACD {display(latestMacd.macd)}</b><b className="signal-line-key">訊號 {display(latestMacd.signal)}</b><b className={latestMacd.histogram === null ? "" : latestMacd.histogram >= 0 ? "positive" : "negative"}>柱 {display(latestMacd.histogram)}</b></p></header><svg viewBox={`0 0 ${width} ${macdHeight}`} preserveAspectRatio="none" role="img" aria-label="MACD(12、26、9) 指標圖"><line className="indicator-zero" x1="0" x2={width} y1="48" y2="48" />{macd.map((value, index) => value.histogram === null ? null : <rect key={points[index].timestamp} data-role="macd-histogram-bar" x={index * xStep + xStep * 0.18} y={Math.min(48, macdY(value.histogram))} width={Math.max(1, xStep * 0.64)} height={Math.max(1, Math.abs(macdY(value.histogram) - 48))} fill={histogramColor(value.histogram)} opacity="0.6" />)}{macdPath && <path data-role="macd-line" className="macd-line" d={macdPath} fill="none" vectorEffect="non-scaling-stroke" />}{signalPath && <path data-role="macd-signal-line" className="macd-signal-line" d={signalPath} fill="none" vectorEffect="non-scaling-stroke" />}<line data-role="macd-selected-line" className="indicator-selected-line" x1={selectedX} x2={selectedX} y1="0" y2={macdHeight} />{points.map((point, index) => <rect key={point.timestamp} data-role="macd-hit" className="indicator-hit" x={index * xStep} y="0" width={xStep} height={macdHeight} fill="transparent" role="button" tabIndex={0} aria-label={`${formatIndicatorDate(point.timestamp)}：MACD ${display(macd[index].macd)}、訊號 ${display(macd[index].signal)}、柱 ${display(macd[index].histogram)}`} onClick={() => onSelectTimestamp(point.timestamp)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectTimestamp(point.timestamp); } }} />)}</svg></div>
    <div className={`indicator-panel rsi-panel ${rsiZone}`}><header><div><span>短週期強弱</span><strong>RSI(6)</strong></div><p><b data-role="rsi-current" className={rsiZone}>{latestRsi === null ? "—" : latestRsi.toFixed(1)}</b><small>{RSI_REFERENCE_BANDS.upper}／{RSI_REFERENCE_BANDS.lower} 門檻</small></p></header><div className={`rsi-alert ${rsiZone}`} aria-live="polite"><span>目前 RSI(6)</span><strong>{latestRsi === null ? "—" : latestRsi.toFixed(1)}</strong><em>{rsiAlertText}</em></div><div data-role="rsi-extreme-entry" className={`rsi-entry-notification ${latestExtremeEntry?.zone ?? "unavailable"} ${isExtremeStillActive ? "active" : "inactive"}`}><span>極端區通知</span><strong>{extremeEntryText}</strong></div><svg viewBox={`0 0 ${width} ${rsiHeight}`} preserveAspectRatio="none" role="img" aria-label={`RSI(6) 指標圖，目前數值 ${latestRsi === null ? "資料不足" : latestRsi.toFixed(1)}，${rsiAlertText}；${extremeEntryText}`}><rect data-role="rsi-overbought-zone" className="rsi-zone-overbought" x="0" y="8" width={width} height={rsiY(RSI_REFERENCE_BANDS.upper) - 8} /><rect data-role="rsi-oversold-zone" className="rsi-zone-oversold" x="0" y={rsiY(RSI_REFERENCE_BANDS.lower)} width={width} height={rsiY(0) - rsiY(RSI_REFERENCE_BANDS.lower)} /><line className="rsi-band" x1="0" x2={width} y1={rsiY(RSI_REFERENCE_BANDS.upper)} y2={rsiY(RSI_REFERENCE_BANDS.upper)} /><line className="rsi-band" x1="0" x2={width} y1={rsiY(RSI_REFERENCE_BANDS.lower)} y2={rsiY(RSI_REFERENCE_BANDS.lower)} /><text className="rsi-threshold" x="3" y={rsiY(RSI_REFERENCE_BANDS.upper) - 2}>{RSI_REFERENCE_BANDS.upper}</text><text className="rsi-threshold" x="3" y={rsiY(RSI_REFERENCE_BANDS.lower) - 2}>{RSI_REFERENCE_BANDS.lower}</text>{rsiPath && <path data-role="rsi6-line" className="rsi6-line" d={rsiPath} fill="none" vectorEffect="non-scaling-stroke" />}<line data-role="rsi-selected-line" className="indicator-selected-line" x1={selectedX} x2={selectedX} y1="0" y2={rsiHeight} />{latestRsi !== null && <circle data-role="rsi-current-marker" className={`rsi-current-marker ${rsiZone}`} cx={width - xStep / 2} cy={rsiY(latestRsi)} r="3.3" />}{points.map((point, index) => <rect key={point.timestamp} data-role="rsi-hit" className="indicator-hit" x={index * xStep} y="0" width={xStep} height={rsiHeight} fill="transparent" role="button" tabIndex={0} aria-label={`${formatIndicatorDate(point.timestamp)}：RSI(6) ${display(rsi6[index])}`} onClick={() => onSelectTimestamp(point.timestamp)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectTimestamp(point.timestamp); } }} />)}</svg></div><div className="detail-indicator-inspector" aria-live="polite"><div><span>單日指標</span><strong data-role="selected-indicator-date">{formatIndicatorDate(selectedPoint.timestamp)}</strong></div><dl><div><dt>MACD</dt><dd data-role="selected-macd">{display(selectedMacd.macd)}</dd></div><div><dt>訊號</dt><dd data-role="selected-macd-signal">{display(selectedMacd.signal)}</dd></div><div><dt>柱</dt><dd data-role="selected-macd-histogram">{display(selectedMacd.histogram)}</dd></div><div><dt>RSI(6)</dt><dd data-role="selected-rsi">{display(selectedRsi)}</dd></div></dl><p>點按 MACD 或 RSI 圖表，或以鍵盤 Enter／空白鍵查閱該交易日數值。</p></div>
  </section>;
}

function StockDetails({ stock, onSummary }: { stock: Stock; onSummary: () => void }) {
  return <div className="stock-detail-panel"><div><span>市值</span><strong>{stock.marketCapLabel}</strong></div><div><span>本益比</span><strong>{stock.pe}</strong></div><div><span>成交量</span><strong>{stock.volume.toLocaleString("en-US")}</strong></div><DetailPriceChart ticker={stock.ticker} /><button type="button" className="ai-summary-inline" onClick={onSummary}><Sparkles size={14} /> 產生 AI 快照摘要</button></div>;
}

function StockRow({ stock, rank, history, currentPrice, isHistoryLoading, isExpanded, isFavorite, onToggle, onToggleWatchlist, onSummary }: { stock: Stock; rank: number; history?: MiniPriceHistory; currentPrice?: number; isHistoryLoading: boolean; isExpanded: boolean; isFavorite: boolean; onToggle: () => void; onToggleWatchlist: () => void; onSummary: () => void }) {
  const rankTier = getRankBadgeTier(rank);
  const rankTierLabel = rankTier === "gold" ? "金牌" : rankTier === "silver" ? "銀牌" : rankTier === "bronze" ? "銅牌" : null;
  const isPositiveChange = stock.change >= 0;
  const displayPrice = currentPrice ?? stock.price;
  const cardMetrics = getStockCardMetrics(stock);
  return (
    <>
      <tr className={`stock-row ${isExpanded ? "expanded" : ""}`}>
        <td className="rank-cell"><span className={`rank-badge${rankTier ? ` rank-badge--${rankTier}` : ""}`} data-rank-tier={rankTier ?? undefined} aria-label={`目前第 ${rank} 名${rankTierLabel ? `，${rankTierLabel}徽章` : ""}`}>{rank}</span></td>
        <td><a className="ticker-link" href={`https://finviz.com/quote.ashx?t=${stock.ticker}`} target="_blank" rel="noreferrer">{stock.ticker}<ArrowUpRight size={13} /></a></td>
        <td><div className="stock-card-company"><div className="stock-card-primary-row"><div className="stock-card-primary-info"><div className="company-cell"><strong>{stock.company}</strong><span>{stock.sector} · {stock.industry} · {stock.country}</span></div></div><MiniCandlestick ticker={stock.ticker} history={history} isLoading={isHistoryLoading} /></div><div className="stock-card-metric-row" aria-label={`${stock.ticker} 五項評估指標`}>{cardMetrics.map((metric) => <span key={metric.label} className={metric.isUnavailable ? "unavailable" : ""}><small>{metric.label}</small><b>{metric.value}</b></span>)}</div><button type="button" className="stock-card-detail-row" onClick={onToggle} aria-expanded={isExpanded} aria-label={`${isExpanded ? "收合" : "展開"} ${stock.ticker} 的詳細資料`}><span>細節</span><span>{isExpanded ? "收合" : "展開"}<ChevronDown size={13} /></span></button><button type="button" className={`watchlist-row-toggle ${isFavorite ? "is-saved" : ""}`} data-role="watchlist-toggle" data-ticker={stock.ticker} aria-pressed={isFavorite} aria-label={isFavorite ? `從自選股移除 ${stock.ticker}` : `加入 ${stock.ticker} 至自選股`} title={isFavorite ? "移除自選股" : "加入自選股"} onClick={onToggleWatchlist}>{isFavorite ? <X size={14} /> : <Plus size={15} />}</button></div></td>
        <td className="num">{stock.marketCapLabel}</td><td className="num muted-num">{stock.pe}</td><td className="num">{formatUsd(displayPrice)}</td><td><span className={`change-pill ${isPositiveChange ? "positive" : "negative"}`}>{isPositiveChange ? "+" : ""}{stock.change.toFixed(2)}%</span></td><td className="num">{stock.volume.toLocaleString("en-US")}</td><td className="ai-cell"><button type="button" className="ai-summary-button" onClick={onSummary}><Sparkles size={14} /> AI 摘要</button></td><td><a className="row-link" href={`https://finviz.com/quote.ashx?t=${stock.ticker}`} target="_blank" rel="noreferrer" aria-label={`開啟 ${stock.ticker} Finviz 報價頁`}><ArrowUpRight size={16} /></a></td>
      </tr>
      {isExpanded && <tr className="stock-detail-row"><td className="stock-detail-cell" colSpan={10}><StockDetails stock={stock} onSummary={onSummary} /></td></tr>}
    </>
  );
}
