import { router } from "./trpc";
import { priceHistoryRouter } from "./routers/priceHistory";
import { stockSummaryRouter } from "./routers/stockSummary";
import { finvizSyncRouter } from "./routers/finvizSync";

export const appRouter = router({
  priceHistory: priceHistoryRouter,
  stockSummary: stockSummaryRouter,
  finvizSync: finvizSyncRouter,
});

export type AppRouter = typeof appRouter;
