import { index, int, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Cloudflare D1 版本的 schema，取代原本 MySQL/TiDB 版本。
 *
 * 沒有 users 表：原專案的 Manus OAuth 使用者系統在這個單人工具裡從未真正
 * 被用來限制任何功能（所有 tRPC procedure 都是 publicProcedure），拆離 Manus
 * 平台後也沒有 OAuth 提供者可用，所以直接拿掉，改用單一 bearer token
 * （ADMIN_TOKEN，見 src/trpc.ts）保護「手動觸發同步 / 排程開關」這類敏感操作。
 */

export const finvizSyncRuns = sqliteTable("finviz_sync_runs", {
  id: int("id").primaryKey({ autoIncrement: true }),
  trigger: text("trigger", { enum: ["manual", "cron"] }).notNull(),
  status: text("status", { enum: ["running", "succeeded", "partial", "failed"] }).notNull(),
  startedAt: int("started_at", { mode: "timestamp_ms" }).notNull(),
  finishedAt: int("finished_at", { mode: "timestamp_ms" }),
  sourceUrl: text("source_url").notNull(),
  successfulScreens: int("successful_screens").notNull().default(0),
  failedScreens: int("failed_screens").notNull().default(0),
  errorMessage: text("error_message"),
  /** JSON 字串（D1 沒有原生 json 型別），存 { screenKey: errorMessage } */
  details: text("details"),
});

export const finvizScreenSnapshots = sqliteTable(
  "finviz_screen_snapshots",
  {
    id: int("id").primaryKey({ autoIncrement: true }),
    runId: int("run_id").notNull(),
    screenKey: text("screen_key").notNull(),
    screenName: text("screen_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceKind: text("source_kind").notNull().default("public-finviz"),
    fetchedAt: int("fetched_at", { mode: "timestamp_ms" }).notNull(),
    stockCount: int("stock_count").notNull(),
    /** JSON 字串：股票陣列，或內部人資訊視角的 { buy, sale } 物件 */
    stocks: text("stocks").notNull(),
  },
  (table) => [
    index("finviz_snapshots_screen_fetched_at_idx").on(table.screenKey, table.fetchedAt),
    index("finviz_snapshots_run_id_idx").on(table.runId),
  ]
);

export const finvizSyncSettings = sqliteTable("finviz_sync_settings", {
  id: int("id").primaryKey(),
  scheduleEnabled: int("schedule_enabled", { mode: "boolean" }).notNull().default(true),
  syncInProgress: int("sync_in_progress", { mode: "boolean" }).notNull().default(false),
  syncStartedAt: int("sync_started_at", { mode: "timestamp_ms" }),
  lastManualTriggeredAt: int("last_manual_triggered_at", { mode: "timestamp_ms" }),
  lastSuccessfulRunId: int("last_successful_run_id"),
  lastSuccessfulAt: int("last_successful_at", { mode: "timestamp_ms" }),
});
