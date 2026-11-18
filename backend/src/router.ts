import { router } from "./trpc";
import { priceHistoryRouter } from "./routers/priceHistory";
import { stockSummaryRouter } from "./routers/stockSummary";
import { finvizSyncRouter } from "./routers/finvizSync";
import { performanceRouter } from "./routers/performance";

export const appRouter = router({
  priceHistory: priceHistoryRouter,
  stockSummary: stockSummaryRouter,
  finvizSync: finvizSyncRouter,
  performance: performanceRouter,
});

export type AppRouter = typeof appRouter;
