import type { Db } from "../db/client";
import { sendDigest, type DigestChannels } from "../notify";
import { getScreenHistories, type ScreenHistory } from "./screenHistory";
import { SCREEN_SOURCES } from "./screenSources";

/** 每個視角在推播裡最多列幾檔代碼，避免 Top Gainers/Losers 這種每天大換血的名單洗版。 */
const MAX_TICKERS_PER_LINE = 8;

function formatTickerList(tickers: string[]): string {
  if (tickers.length <= MAX_TICKERS_PER_LINE) return tickers.join(", ");
  return `${tickers.slice(0, MAX_TICKERS_PER_LINE).join(", ")} …等 ${tickers.length} 檔`;
}

/** 純函式：組出推播文字；所有視角都沒有進出時回傳 null（例如美股假日）。 */
export function buildDailyDigest(histories: Record<string, ScreenHistory>, siteUrl: string | undefined): string | null {
  const sections: string[] = [];
  let sessionDate: string | null = null;
  let hasChange = false;

  for (const source of SCREEN_SOURCES) {
    const history = histories[source.key];
    if (!history || !history.sessionDate) continue;
    sessionDate ??= history.sessionDate;

    const total = Object.keys(history.streaks).length;
    const lines = [`【${source.name}】${total} 檔`];

    if (!history.previousSessionDate) {
      lines.push("・尚無前一交易日資料，明天開始比對");
    } else {
      if (history.newTickers.length || history.dropped.length) hasChange = true;
      lines.push(`・新進 ${history.newTickers.length}${history.newTickers.length ? `：${formatTickerList(history.newTickers)}` : ""}`);
      lines.push(`・剔除 ${history.dropped.length}${history.dropped.length ? `：${formatTickerList(history.dropped.map((item) => item.ticker))}` : ""}`);
    }

    const longest = Object.entries(history.streaks)
      .filter(([, days]) => days >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (longest.length) {
      lines.push(`・連續上榜：${longest.map(([ticker, days]) => `${ticker} ${days}${days >= history.sessionsAvailable ? "+" : ""} 天`).join("、")}`);
    }

    sections.push(lines.join("\n"));
  }

  if (!sections.length || !hasChange) return null;

  const header = `📊 Stock Scanner 每日進出名單\n美股交易日 ${sessionDate}`;
  const footer = siteUrl ? `\n🔗 ${siteUrl}` : "";
  return `${header}\n\n${sections.join("\n\n")}${footer}`;
}

export type DigestResult = { sent: boolean; reason: string; channels?: Record<string, boolean> };

export async function sendDailyDigest(db: Db, channels: DigestChannels, siteUrl: string | undefined): Promise<DigestResult> {
  const histories = await getScreenHistories(db);
  const message = buildDailyDigest(histories, siteUrl);
  if (!message) return { sent: false, reason: "所有視角都沒有進出變化（可能是美股休市）" };
  const result = await sendDigest(message, channels);
  return { sent: Object.values(result).some(Boolean), reason: "ok", channels: result };
}
