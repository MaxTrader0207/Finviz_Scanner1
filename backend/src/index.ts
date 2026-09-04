import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext, type Env } from "./context";
import { getDb } from "./db/client";
import { runFinvizSync } from "./finviz/syncRunner";

const TRPC_ENDPOINT = "/trpc";

function corsHeaders(env: Env, request: Request): HeadersInit {
  const allowedOrigin = env.ALLOWED_ORIGIN || "*";
  const requestOrigin = request.headers.get("origin");
  const originToAllow = allowedOrigin === "*" ? "*" : requestOrigin === allowedOrigin ? allowedOrigin : allowedOrigin;
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
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runFinvizSync(getDb(env.DB), "cron", env.ALERT_WEBHOOK_URL).catch((error) => {
        console.error("[Finviz Sync] scheduled run failed:", error);
      })
    );
  },
};
