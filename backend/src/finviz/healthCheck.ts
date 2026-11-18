import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { finvizScreenSnapshots, finvizSyncSettings } from "../db/schema";
import { sendDigest, type DigestChannels } from "../notify";
import { INSIDER_SCREEN_KEY, SCREEN_SOURCES } from "./screenSources";

/** cron 每天跑一次，超過這個時數沒有新的成功快照就算「資料過期」。 */
export const STALE_AFTER_HOURS = 26;
/** 同步鎖超過這麼久還沒釋放，視為 Worker 中途被回收、鎖卡住了。 */
export const STUCK_LOCK_MINUTES = 30;
const HOUR_MS = 60 * 60 * 1000;

export type HealthIssue = { kind: "stale-sync" | "stale-screen" | "stuck-lock"; message: string };

export type HealthInput = {
  now: Date;
  lastSuccessfulAt: Date | null;
  syncInProgress: boolean;
  syncStartedAt: Date | null;
  screens: Array<{ key: string; name: string; latestFetchedAt: Date | null }>;
};

const TAIPEI = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const fmt = (date: Date | null) => (date ? TAIPEI.format(date) : "從未");

/** 純函式：判斷有哪些健康問題。 */
export function evaluateHealth(input: HealthInput): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const staleBefore = input.now.getTime() - STALE_AFTER_HOURS * HOUR_MS;

  if (input.syncInProgress && input.syncStartedAt && input.now.getTime() - input.syncStartedAt.getTime() > STUCK_LOCK_MINUTES * 60 * 1000) {
    issues.push({ kind: "stuck-lock", message: `同步鎖從 ${fmt(input.syncStartedAt)} 卡住到現在，已自動解除` });
  }

  if (!input.lastSuccessfulAt || input.lastSuccessfulAt.getTime() < staleBefore) {
    issues.push({ kind: "stale-sync", message: `超過 ${STALE_AFTER_HOURS} 小時沒有成功同步（上次成功：${fmt(input.lastSuccessfulAt)}，台灣時間）` });
    return issues; // 整體都過期了，就不必再逐一列出每個視角
  }

  const staleScreens = input.screens.filter((screen) => !screen.latestFetchedAt || screen.latestFetchedAt.getTime() < staleBefore);
  if (staleScreens.length) {
    issues.push({ kind: "stale-screen", message: `以下視角連續抓取失敗：${staleScreens.map((screen) => `${screen.name}（最後成功 ${fmt(screen.latestFetchedAt)}）`).join("、")}` });
  }
  return issues;
}

export async function runHealthCheck(db: Db, channels: DigestChannels, siteUrl: string | undefined, now = new Date()) {
  const [settings] = await db.select().from(finvizSyncSettings).where(eq(finvizSyncSettings.id, 1)).limit(1);
  const allScreens = [...SCREEN_SOURCES.map((source) => ({ key: source.key, name: source.name })), { key: INSIDER_SCREEN_KEY, name: "內部人資訊" }];
  const screens = await Promise.all(
    allScreens.map(async (screen) => {
      const [row] = await db
        .select({ fetchedAt: finvizScreenSnapshots.fetchedAt })
        .from(finvizScreenSnapshots)
        .where(eq(finvizScreenSnapshots.screenKey, screen.key))
        .orderBy(desc(finvizScreenSnapshots.fetchedAt))
        .limit(1);
      return { ...screen, latestFetchedAt: row?.fetchedAt ?? null };
    })
  );

  const issues = evaluateHealth({
    now,
    lastSuccessfulAt: settings?.lastSuccessfulAt ?? null,
    syncInProgress: Boolean(settings?.syncInProgress),
    syncStartedAt: settings?.syncStartedAt ?? null,
    screens,
  });

  if (issues.some((issue) => issue.kind === "stuck-lock")) {
    await db.update(finvizSyncSettings).set({ syncInProgress: false }).where(eq(finvizSyncSettings.id, 1));
  }

  if (issues.length) {
    const message = `⚠️ Stock Scanner 資料健康檢查\n\n${issues.map((issue) => `・${issue.message}`).join("\n")}${siteUrl ? `\n\n🔗 ${siteUrl}` : ""}`;
    await sendDigest(message, channels);
  }
  return { ok: issues.length === 0, issues };
}
