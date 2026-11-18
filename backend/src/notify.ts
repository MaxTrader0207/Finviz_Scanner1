export type NotificationPayload = {
  title: string;
  content: string;
};

/**
 * 取代 Manus 的 notifyOwner()（原本呼叫 Forge 平台的通知服務）。
 * 這裡改用任何相容「Discord/Slack incoming webhook」格式的 URL：
 * 兩者都接受 { content: string } 這種最小 JSON body。
 * 沒設定 ALERT_WEBHOOK_URL 時直接 no-op（只印 log），不會讓同步流程失敗。
 */
export async function notifyOwner(payload: NotificationPayload, webhookUrl: string | undefined): Promise<boolean> {
  const message = `**${payload.title}**\n${payload.content}`;

  if (!webhookUrl) {
    console.warn("[Notify] ALERT_WEBHOOK_URL not configured, skipping notification:", payload.title);
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: message.slice(0, 1900) }), // Discord 訊息長度上限保護
    });
    if (!response.ok) {
      console.warn(`[Notify] Webhook responded ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notify] Failed to call webhook:", error);
    return false;
  }
}

export type DigestChannels = {
  /** Discord（或相容的 Slack）incoming webhook；沒設時改用 ALERT_WEBHOOK_URL。 */
  discordWebhookUrl?: string;
  /** LINE Messaging API 的 Channel access token（長期）。 */
  lineChannelAccessToken?: string;
  /** 推播對象：自己的 LINE userId（U 開頭）或群組 ID。 */
  lineTo?: string;
};

const DISCORD_LIMIT = 1900;
const LINE_LIMIT = 4900;

/** Discord 單則訊息 2000 字上限：依段落切成多則依序送出。 */
export function splitMessage(message: string, limit: number): string[] {
  if (message.length <= limit) return [message];
  const chunks: string[] = [];
  let current = "";
  for (const block of message.split("\n\n")) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = block.length <= limit ? block : block.slice(0, limit);
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * 每日進出名單推播。LINE Notify 已在 2025/3 停止服務，所以 LINE 走 Messaging API
 * 的 push message。各通道獨立，任一個沒設定或失敗都不影響其他通道與同步流程。
 */
export async function sendDigest(message: string, channels: DigestChannels): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};

  if (channels.discordWebhookUrl) {
    let ok = true;
    for (const chunk of splitMessage(message, DISCORD_LIMIT)) {
      try {
        const response = await fetch(channels.discordWebhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: chunk }),
        });
        if (!response.ok) {
          console.warn(`[Digest] Discord responded ${response.status}`);
          ok = false;
        }
      } catch (error) {
        console.warn("[Digest] Discord failed:", error);
        ok = false;
      }
    }
    result.discord = ok;
  }

  if (channels.lineChannelAccessToken && channels.lineTo) {
    try {
      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${channels.lineChannelAccessToken}` },
        body: JSON.stringify({
          to: channels.lineTo,
          // 一次 push 最多 5 則訊息，正常情況一則就夠。
          messages: splitMessage(message, LINE_LIMIT).slice(0, 5).map((text) => ({ type: "text", text })),
        }),
      });
      if (!response.ok) console.warn(`[Digest] LINE responded ${response.status}: ${await response.text()}`);
      result.line = response.ok;
    } catch (error) {
      console.warn("[Digest] LINE failed:", error);
      result.line = false;
    }
  }

  if (!Object.keys(result).length) console.warn("[Digest] 沒有設定任何推播通道，略過");
  return result;
}
