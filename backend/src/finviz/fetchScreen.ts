import { parseFinvizScreenerHtml, type ScrapedStock } from "./parseScreen";
import { parseFinvizInsiderTradingHtml, type ScrapedInsiderTransaction } from "./parseInsiderTrading";
import { SCREEN_SOURCES, INSIDER_TRADING_SOURCE_URLS } from "./screenSources";

const REQUEST_TIMEOUT_MS = 15_000;
const DELAY_BETWEEN_REQUESTS_MS = 2_000;
const REQUEST_USER_AGENT = "SignalLedger/1.0 (personal research dashboard; contact: maxwei6699@gmail.com)";

const SCREENS_WHERE_ZERO_RESULTS_ARE_EXPECTED = new Set(["newHighMomentum", "megaValueQuality"]);

export type ScreenFetchResult =
  | { screenKey: string; screenName: string; sourceUrl: string; status: "ok"; stocks: ScrapedStock[]; skippedRowCount: number }
  | { screenKey: string; screenName: string; sourceUrl: string; status: "error"; error: string };

export type InsiderFetchResult =
  | { status: "ok"; buy: ScrapedInsiderTransaction[]; sale: ScrapedInsiderTransaction[] }
  | { status: "error"; error: string };

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": REQUEST_USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Finviz responded ${response.status} for ${url}`);
  return response.text();
}

async function fetchOneScreen(screenKey: string, screenName: string, sourceUrl: string): Promise<ScreenFetchResult> {
  try {
    const html = await fetchHtml(sourceUrl);
    const { stocks, skippedRowCount } = parseFinvizScreenerHtml(html);

    if (stocks.length === 0 && !SCREENS_WHERE_ZERO_RESULTS_ARE_EXPECTED.has(screenKey)) {
      throw new Error(`Parsed 0 stocks (skipped ${skippedRowCount} rows) — selector likely stale`);
    }

    return { screenKey, screenName, sourceUrl, status: "ok", stocks, skippedRowCount };
  } catch (error) {
    return { screenKey, screenName, sourceUrl, status: "error", error: error instanceof Error ? error.message : String(error) };
  }
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
    return { status: "ok", buy: buy.transactions, sale: sale.transactions };
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
    results.push(await fetchOneScreen(screen.key, screen.name, screen.sourceUrl));
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
  }

  const insiderTrading = await fetchInsiderTrading();

  return { screens: results, insiderTrading };
}
