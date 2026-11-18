import { getDb } from "./db/client";

/**
 * wrangler.toml 裡宣告的 bindings/vars 對應的型別。
 * DB 是 D1 binding；其餘是一般環境變數/secrets。
 */
export type Env = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  ALERT_WEBHOOK_URL?: string;
  ALLOWED_ORIGIN?: string;
  /** 每日進出名單推播：Discord webhook（沒設時沿用 ALERT_WEBHOOK_URL）。 */
  DIGEST_WEBHOOK_URL?: string;
  /** 每日進出名單推播：LINE Messaging API。兩個都設才會推 LINE。 */
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  LINE_TO?: string;
  /** 推播訊息底部附的前端網址（wrangler.toml [vars]）。 */
  SITE_URL?: string;
};

export function digestChannelsFromEnv(env: Env) {
  return {
    discordWebhookUrl: env.DIGEST_WEBHOOK_URL || env.ALERT_WEBHOOK_URL,
    lineChannelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
    lineTo: env.LINE_TO,
  };
}

/**
 * 單人使用工具不需要完整的 OAuth 系統。這裡用一個簡單的 bearer token
 * （ADMIN_TOKEN，存在 Cloudflare secret）取代原本 Manus 平台的登入機制，
 * 只保護「手動觸發同步」這類敏感操作；一般讀取（screener 資料、AI 摘要）維持公開。
 */
export function createContext({ req, env }: { req: Request; env: Env }) {
  const authHeader = req.headers.get("authorization") ?? "";
  const providedToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  const isAdmin = Boolean(env.ADMIN_TOKEN) && providedToken === env.ADMIN_TOKEN;

  return {
    db: getDb(env.DB),
    env,
    isAdmin,
  };
}

export type TrpcContext = ReturnType<typeof createContext>;
