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
