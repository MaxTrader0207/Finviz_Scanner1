import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { alertChannelsFromEnv, createContext, digestChannelsFromEnv, type Env } from "./context";
import { getDb } from "./db/client";
import { runFinvizSync } from "./finviz/syncRunner";
import { sendDailyDigest } from "./finviz/dailyDigest";
import { isNewSessionSinceLastCron } from "./finviz/screenHistory";
import { recordEntries, updateReturns } from "./finviz/performance";
import { runHealthCheck } from "./finviz/healthCheck";

/** wrangler.toml 的第二個 cron：同步之後 4 小時做健康檢查。 */
const HEALTH_CHECK_CRON = "0 2 * * *";

const TRPC_ENDPOINT = "/trpc";

function corsHeaders(env: Env, request: Request): HeadersInit {
  const allowedOrigin = env.ALLOWED_ORIGIN || "*";
  const requestOrigin = request.headers.get("origin") ?? "";
  // GitHub Pages 的網址一律是小寫（跟 GitHub 帳號顯示名稱的大小寫無關），
  // 所以這裡改成不分大小寫比對；比對成功時要原樣回傳瀏覽器送來的 Origin
  // （不是設定值本身），因為瀏覽器要求這個標頭要跟它送出的 Origin逐字元相符。
  const isAllowed = allowedOrigin === "*" || requestOrigin.toLowerCase() === allowedOrigin.toLowerCase();
  const originToAllow = allowedOrigin === "*" ? "*" : isAllowed ? requestOrigin : "null";
  return {
    "access-control-allow-origin": originToAllow,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const headers = corsHeaders(env, request);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...headers, "content-type": "application/json" } });
    }

    if (url.pathname.startsWith(TRPC_ENDPOINT)) {
      const response = await fetchRequestHandler({
        endpoint: TRPC_ENDPOINT,
        req: request,
        router: appRouter,
        createContext: () => createContext({ req: request, env }),
        onError({ error, path }) {
          console.error(`[tRPC] ${path ?? "<unknown>"}:`, error);
        },
      });

      const merged = new Headers(response.headers);
      for (const [key, value] of Object.entries(headers)) merged.set(key, value);
      return new Response(response.body, { status: response.status, headers: merged });
    }

    return new Response("Not found", { status: 404, headers });
  },

  /**
   * 取代原本 Manus Heartbeat 的 HTTP callback 機制：Cloudflare Cron Triggers
   * 由 wrangler.toml 的 [triggers].crons 宣告排程，觸發時直接呼叫這個
   * handler，不需要對外開放的 callback 端點。用 ctx.waitUntil 確保
   * Worker 不會在同步流程（依序抓 7+1 個頁面、中間有節流延遲）跑完前就被回收。
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === HEALTH_CHECK_CRON) {
      ctx.waitUntil(
        runHealthCheck(getDb(env.DB), alertChannelsFromEnv(env), env.SITE_URL)
          .then((result) => console.log("[Health]", JSON.stringify(result)))
          .catch((error) => console.error("[Health] check failed:", error))
      );
      return;
    }
    ctx.waitUntil(
      (async () => {
        const db = getDb(env.DB);
        const startedAt = new Date();
        const summary = await runFinvizSync(db, "cron", env.ALERT_WEBHOOK_URL);
        if (summary.successfulScreens === 0) return;

        // 篩選績效：記錄新進事件、補齊到期的報酬。獨立 try，失敗不影響推播。
        try {
          const inserted = await recordEntries(db); // 讀全部歷史：只會新增還沒記過的事件，順便自動回補
          const returns = await updateReturns(db);
          console.log("[Performance]", JSON.stringify({ inserted, ...returns }));
        } catch (error) {
          console.error("[Performance] update failed:", error);
        }

        // 同步完成後推播每日進出名單；週末/週一早上抓到的仍是同一個美股交易日，不重複推。
        if (!(await isNewSessionSinceLastCron(db, summary.runId, startedAt))) {
          console.log("[Digest] 與上次 cron 為同一美股交易日，略過推播");
          return;
        }
        const digest = await sendDailyDigest(db, digestChannelsFromEnv(env), env.SITE_URL);
        console.log("[Digest]", JSON.stringify(digest));
      })().catch((error) => {
        console.error("[Finviz Sync] scheduled run failed:", error);
      })
    );
  },
};
