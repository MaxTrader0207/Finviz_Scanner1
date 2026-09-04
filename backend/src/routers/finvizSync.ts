import { adminProcedure, publicProcedure, router } from "../trpc";
import { runFinvizSync, getLatestSnapshots, getLatestRunStatus } from "../finviz/syncRunner";

export const finvizSyncRouter = router({
  /** 前端用這支取代原本對 screenerData.ts 的靜態 import。 */
  getLatestSnapshots: publicProcedure.query(({ ctx }) => getLatestSnapshots(ctx.db)),

  /** 顯示「資料更新於 X 分鐘前」或同步失敗提示用。 */
  getStatus: publicProcedure.query(({ ctx }) => getLatestRunStatus(ctx.db)),

  /**
   * 手動觸發一次同步；限持有 ADMIN_TOKEN 的請求，避免公開後被任意戳。
   * 排程本身宣告在 wrangler.toml 的 [triggers].crons，不需要額外的註冊 API。
   */
  triggerNow: adminProcedure.mutation(({ ctx }) => runFinvizSync(ctx.db, "manual", ctx.env.ALERT_WEBHOOK_URL)),
});
