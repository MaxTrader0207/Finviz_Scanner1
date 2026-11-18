import { parseDefensiveMetrics, parseFinvizScreenerHtml, type ScrapedStock } from "./parseScreen";
import { parseFinvizInsiderTradingHtml, type ScrapedInsiderTransaction } from "./parseInsiderTrading";
import { SCREEN_SOURCES, INSIDER_TRADING_SOURCE_URLS } from "./screenSources";

const REQUEST_TIMEOUT_MS = 15_000;
const DELAY_BETWEEN_REQUESTS_MS = 2_000;
const REQUEST_USER_AGENT = "SignalLedger/1.0 (personal research dashboard; contact: maxwei6699@gmail.com)";

const SCREENS_WHERE_ZERO_RESULTS_ARE_EXPECTED = new Set(["newHighMomentum", "megaValueQuality"]);

export type ScreenFetchResult =
  | { screenKey: string; screenName: string; sourceUrl: string; status: "ok"; stocks: ScrapedStock[]; skippedRowCount: number }
  | { screenKey: string; screenName: string; sourceUrl: string; status: "error"; error: string };

export type EnrichedInsiderTransaction = ScrapedInsiderTransaction & { company?: string; sector?: string; industry?: string };

export type InsiderFetchResult =
  | { status: "ok"; buy: EnrichedInsiderTransaction[]; sale: EnrichedInsiderTransaction[] }
  | { status: "error"; error: string };

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": REQUEST_USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Finviz responded ${response.status} for ${url}`);
  return response.text();
}

async function fetchOneScreen(screenKey: string, screenName: string, sourceUrl: string, valuationSourceUrl: string | undefined): Promise<ScreenFetchResult> {
  try {
    const html = await fetchHtml(sourceUrl);
    const { stocks, skippedRowCount } = parseFinvizScreenerHtml(html);

    if (stocks.length === 0 && !SCREENS_WHERE_ZERO_RESULTS_ARE_EXPECTED.has(screenKey)) {
      throw new Error(`Parsed 0 stocks (skipped ${skippedRowCount} rows) — selector likely stale`);
    }

    let enrichedStocks = stocks;
    if (valuationSourceUrl && stocks.length > 0) {
      // P/B 不在 Overview 檢視裡，額外抓一次 Valuation 檢視、依代碼合併進來。
      // 這一步失敗不影響主要資料——只是這個視角會缺 P/B，不會讓整個視角判定失敗。
      try {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
        const metricsByTicker = parseDefensiveMetrics(await fetchHtml(valuationSourceUrl));
        enrichedStocks = stocks.map((stock) => ({ ...stock, ...(metricsByTicker.get(stock.ticker) ?? {}) }));
      } catch (error) {
        console.warn(`[Finviz Sync] Unable to enrich ${screenKey} with P/B from Valuation view:`, error);
      }
    }

    return { screenKey, screenName, sourceUrl, status: "ok", stocks: enrichedStocks, skippedRowCount };
  } catch (error) {
    return { screenKey, screenName, sourceUrl, status: "error", error: error instanceof Error ? error.message : String(error) };
  }
}

/** Finviz screener 的 t= 參數一次查一組代碼，Overview 檢視每頁 20 列。 */
export const PROFILE_CHUNK_SIZE = 20;

export function buildTickerProfileUrls(tickers: string[]): string[] {
  const unique = Array.from(new Set(tickers)).sort();
  const urls: string[] = [];
  for (let i = 0; i < unique.length; i += PROFILE_CHUNK_SIZE) {
    urls.push(`https://finviz.com/screener?v=111&t=${unique.slice(i, i + PROFILE_CHUNK_SIZE).join(",")}`);
  }
  return urls;
}

/**
 * 內部人交易頁沒有公司名稱與產業，用 screener 的代碼查詢批次補上，讓前端的產業構成圖
 * 不會全部落在「未分類」。任何一批失敗都只是少一些產業資料，不影響內部人快照本身。
 */
async function fetchTickerProfiles(tickers: string[]): Promise<Map<string, { company: string; sector: string; industry: string }>> {
  const profiles = new Map<string, { company: string; sector: string; industry: string }>();
  for (const url of buildTickerProfileUrls(tickers)) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
    try {
      const { stocks } = parseFinvizScreenerHtml(await fetchHtml(url));
      for (const stock of stocks) profiles.set(stock.ticker, { company: stock.company, sector: stock.sector, industry: stock.industry });
    } catch (error) {
      console.warn("[Finviz Sync] Unable to fetch insider ticker profiles:", error);
    }
  }
  return profiles;
}

async function fetchInsiderTrading(): Promise<InsiderFetchResult> {
  try {
    const [buyHtml, saleHtml] = await Promise.all([
      fetchHtml(INSIDER_TRADING_SOURCE_URLS.buy),
      fetchHtml(INSIDER_TRADING_SOURCE_URLS.sale),
    ]);
    const buy = parseFinvizInsiderTradingHtml(buyHtml);
    const sale = parseFinvizInsiderTradingHtml(saleHtml);
    if (buy.transactions.length === 0 && sale.transactions.length === 0) {
      throw new Error("Parsed 0 insider transactions — selector likely stale");
    }
    const profiles = await fetchTickerProfiles([...buy.transactions, ...sale.transactions].map((transaction) => transaction.ticker));
    const enrich = (transaction: ScrapedInsiderTransaction): EnrichedInsiderTransaction => {
      const profile = profiles.get(transaction.ticker);
      return profile ? { ...transaction, ...profile } : transaction;
    };
    return { status: "ok", buy: buy.transactions.map(enrich), sale: sale.transactions.map(enrich) };
  } catch (error) {
    return { status: "error", error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 依序抓取每個視角，中間刻意間隔，對一個沒有正式提供程式化存取管道的
 * 免費網站保持保守的請求頻率。Cloudflare Workers 的 CPU 時間限制不含
 * 等待 I/O 的時間，所以這裡的 setTimeout 節流不會被計費目標打斷。
 */
export async function fetchAllScreens(): Promise<{ screens: ScreenFetchResult[]; insiderTrading: InsiderFetchResult }> {
  const results: ScreenFetchResult[] = [];

  for (const screen of SCREEN_SOURCES) {
    results.push(await fetchOneScreen(screen.key, screen.name, screen.sourceUrl, screen.valuationSourceUrl));
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
  }

  const insiderTrading = await fetchInsiderTrading();

  return { screens: results, insiderTrading };
}
