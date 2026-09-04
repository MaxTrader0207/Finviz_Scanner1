import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { finvizScreenSnapshots, finvizSyncRuns, finvizSyncSettings } from "../db/schema";
import { fetchAllScreens } from "./fetchScreen";
import { notifyOwner } from "../notify";
import { INSIDER_SCREEN_KEY, SCREEN_SOURCES } from "./screenSources";

const SETTINGS_ROW_ID = 1;

export type SyncRunSummary = {
  runId: number;
  status: "succeeded" | "partial" | "failed";
  successfulScreens: number;
  failedScreens: number;
  details: Record<string, string>;
};

async function ensureSettingsRow(db: Db) {
  const existing = await db.select().from(finvizSyncSettings).where(eq(finvizSyncSettings.id, SETTINGS_ROW_ID)).limit(1);
  if (existing.length === 0) {
    await db.insert(finvizSyncSettings).values({ id: SETTINGS_ROW_ID });
    return null;
  }
  return existing[0];
}

export async function runFinvizSync(db: Db, trigger: "manual" | "cron", webhookUrl: string | undefined): Promise<SyncRunSummary> {
  const settings = await ensureSettingsRow(db);
  if (settings?.syncInProgress) {
    throw new Error("A Finviz sync is already in progress");
  }

  const now = new Date();
  await db
    .update(finvizSyncSettings)
    .set({ syncInProgress: true, syncStartedAt: now, ...(trigger === "manual" ? { lastManualTriggeredAt: now } : {}) })
    .where(eq(finvizSyncSettings.id, SETTINGS_ROW_ID));

  const [runRow] = await db
    .insert(finvizSyncRuns)
    .values({
      trigger,
      status: "running",
      startedAt: now,
      sourceUrl: "https://finviz.com/screener?v=111",
      successfulScreens: 0,
      failedScreens: 0,
    })
    .returning({ id: finvizSyncRuns.id });
  if (!runRow) throw new Error("Failed to create finviz_sync_runs row");
  const runId = runRow.id;

  try {
    const { screens: screenResults, insiderTrading } = await fetchAllScreens();

    let successCount = 0;
    let failCount = 0;
    const details: Record<string, string> = {};

    for (const result of screenResults) {
      if (result.status === "ok") {
        await db.insert(finvizScreenSnapshots).values({
          runId,
          screenKey: result.screenKey,
          screenName: result.screenName,
          sourceUrl: result.sourceUrl,
          sourceKind: "public-finviz",
          fetchedAt: new Date(),
          stockCount: result.stocks.length,
          stocks: JSON.stringify(result.stocks),
        });
        successCount += 1;
      } else {
        failCount += 1;
        details[result.screenKey] = result.error;
      }
    }

    if (insiderTrading.status === "ok") {
      await db.insert(finvizScreenSnapshots).values({
        runId,
        screenKey: INSIDER_SCREEN_KEY,
        screenName: "內部人資訊",
        sourceUrl: "https://finviz.com/insidertrading?tc=1",
        sourceKind: "public-finviz",
        fetchedAt: new Date(),
        stockCount: insiderTrading.buy.length + insiderTrading.sale.length,
        stocks: JSON.stringify({ buy: insiderTrading.buy, sale: insiderTrading.sale }),
      });
      successCount += 1;
    } else {
      failCount += 1;
      details[INSIDER_SCREEN_KEY] = insiderTrading.error;
    }

    const finalStatus: SyncRunSummary["status"] = failCount === 0 ? "succeeded" : successCount > 0 ? "partial" : "failed";

    await db
      .update(finvizSyncRuns)
      .set({
        status: finalStatus,
        finishedAt: new Date(),
        successfulScreens: successCount,
        failedScreens: failCount,
        details: JSON.stringify(details),
      })
      .where(eq(finvizSyncRuns.id, runId));

    if (successCount > 0) {
      await db
        .update(finvizSyncSettings)
        .set({ lastSuccessfulRunId: runId, lastSuccessfulAt: new Date() })
        .where(eq(finvizSyncSettings.id, SETTINGS_ROW_ID));
    }

    if (finalStatus !== "succeeded") {
      await notifyOwner(
        {
          title: `Finviz 同步${finalStatus === "partial" ? "部分失敗" : "失敗"}`,
          content: `${trigger} 觸發的同步 run #${runId}：成功 ${successCount}／失敗 ${failCount}。\n${Object.entries(details)
            .map(([key, msg]) => `${key}: ${msg}`)
            .join("\n")}`,
        },
        webhookUrl
      );
    }

    return { runId, status: finalStatus, successfulScreens: successCount, failedScreens: failCount, details };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(finvizSyncRuns)
      .set({ status: "failed", finishedAt: new Date(), errorMessage: message })
      .where(eq(finvizSyncRuns.id, runId));
    await notifyOwner({ title: "Finviz 同步發生未預期錯誤", content: `run #${runId} (${trigger}): ${message}` }, webhookUrl);
    throw error;
  } finally {
    await db.update(finvizSyncSettings).set({ syncInProgress: false }).where(eq(finvizSyncSettings.id, SETTINGS_ROW_ID));
  }
}

export type LatestSnapshot = {
  screenKey: string;
  screenName: string;
  sourceUrl: string;
  fetchedAt: Date;
  stockCount: number;
  stocks: unknown;
};

const ALL_SCREEN_KEYS = [...SCREEN_SOURCES.map((s) => s.key), INSIDER_SCREEN_KEY];

/** 前端讀取用：每個 screenKey 各拿「最新一筆快照」（因為失敗的視角本來就不會 insert 新 row，這裡自然只會拿到最後一筆成功的）。 */
export async function getLatestSnapshots(db: Db): Promise<LatestSnapshot[]> {
  const results = await Promise.all(
    ALL_SCREEN_KEYS.map(async (screenKey) => {
      const rows = await db
        .select()
        .from(finvizScreenSnapshots)
        .where(eq(finvizScreenSnapshots.screenKey, screenKey))
        .orderBy(desc(finvizScreenSnapshots.fetchedAt))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return { ...row, stocks: JSON.parse(row.stocks) as unknown };
    })
  );

  return results.filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function getLatestRunStatus(db: Db) {
  const rows = await db.select().from(finvizSyncRuns).orderBy(desc(finvizSyncRuns.startedAt)).limit(1);
  return rows[0] ?? null;
}
