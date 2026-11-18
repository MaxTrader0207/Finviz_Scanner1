import { index, int, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

/**
 * 篩選績效追蹤：每一筆「某檔股票在某個美股交易日新進某個視角」的事件，
 * 以及之後 1／5／20 個交易日的收盤報酬（與同期 SPY 對照）。
 * 由 cron 從 finviz_screen_snapshots 推導寫入，報酬由 Yahoo Finance 日線逐日補齊。
 */
export const screenEntries = sqliteTable(
  "screen_entries",
  {
    id: int("id").primaryKey({ autoIncrement: true }),
    screenKey: text("screen_key").notNull(),
    ticker: text("ticker").notNull(),
    /** 新進榜的美股交易日（YYYY-MM-DD，紐約時間） */
    sessionDate: text("session_date").notNull(),
    /** 快照上的價格（Yahoo 查不到收盤價時的備援） */
    snapshotPrice: real("snapshot_price"),
    /** 進榜當日收盤價（報酬的計算基準） */
    entryClose: real("entry_close"),
    ret1d: real("ret_1d"),
    ret5d: real("ret_5d"),
    ret20d: real("ret_20d"),
    spy1d: real("spy_1d"),
    spy5d: real("spy_5d"),
    spy20d: real("spy_20d"),
    /** 20 日報酬已補齊，或已超過可追蹤期限（例如下市、查無資料） */
    completed: int("completed", { mode: "boolean" }).notNull().default(false),
    updatedAt: int("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("screen_entries_unique_idx").on(table.screenKey, table.ticker, table.sessionDate),
    index("screen_entries_pending_idx").on(table.completed, table.sessionDate),
  ]
);
