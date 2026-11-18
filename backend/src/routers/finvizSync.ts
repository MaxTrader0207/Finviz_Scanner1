import { adminProcedure, publicProcedure, router } from "../trpc";
import { runFinvizSync, getLatestSnapshots, getLatestRunStatus } from "../finviz/syncRunner";
import { getScreenHistories } from "../finviz/screenHistory";
import { sendDailyDigest } from "../finviz/dailyDigest";
import { alertChannelsFromEnv, digestChannelsFromEnv } from "../context";
import { runHealthCheck } from "../finviz/healthCheck";

export const finvizSyncRouter = router({
  /** 前端用這支取代原本對 screenerData.ts 的靜態 import。 */
  getLatestSnapshots: publicProcedure.query(({ ctx }) => getLatestSnapshots(ctx.db)),

  /** 顯示「資料更新於 X 分鐘前」或同步失敗提示用。 */
  /** 每日進出名單 + 連續上榜天數（7 個篩選視角，不含內部人資訊）。 */
  getScreenHistory: publicProcedure.query(({ ctx }) => getScreenHistories(ctx.db)),

  getStatus: publicProcedure.query(({ ctx }) => getLatestRunStatus(ctx.db)),

  /**
   * 手動觸發一次同步；限持有 ADMIN_TOKEN 的請求，避免公開後被任意戳。
   * 排程本身宣告在 wrangler.toml 的 [triggers].crons，不需要額外的註冊 API。
   */
  triggerNow: adminProcedure.mutation(({ ctx }) => runFinvizSync(ctx.db, "manual", ctx.env.ALERT_WEBHOOK_URL)),

  /** 手動跑一次健康檢查（有問題才會發警示）。 */
  runHealthCheck: adminProcedure.mutation(({ ctx }) => runHealthCheck(ctx.db, alertChannelsFromEnv(ctx.env), ctx.env.SITE_URL)),

  /** 手動補發／測試每日進出名單推播（不檢查是否為新交易日）。 */
  sendDigestNow: adminProcedure.mutation(({ ctx }) => sendDailyDigest(ctx.db, digestChannelsFromEnv(ctx.env), ctx.env.SITE_URL)),
});
