import { adminProcedure, publicProcedure, router } from "../trpc";
import { countPendingEntries, getPerformanceSummary, recordEntries, updateReturns } from "../finviz/performance";

export const performanceRouter = router({
  /** 各視角新進後 1／5／20 個交易日的報酬統計（相對 SPY）。 */
  getSummary: publicProcedure.query(({ ctx }) => getPerformanceSummary(ctx.db)),

  /**
   * 回補：從所有歷史快照推導新進事件，並補一批報酬（每次最多 150 檔）。
   * 回傳 remainingDueTickers > 0 時再呼叫一次，直到 0 為止。
   */
  backfill: adminProcedure.mutation(async ({ ctx }) => {
    const inserted = await recordEntries(ctx.db);
    const returns = await updateReturns(ctx.db);
    return { inserted, ...returns, pendingEntries: await countPendingEntries(ctx.db) };
  }),
});
