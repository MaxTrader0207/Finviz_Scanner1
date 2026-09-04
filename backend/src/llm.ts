const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export type ClaudeInvokeParams = {
  model: string;
  maxTokens: number;
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

/** 刻意沿用原本 Manus Forge 代理的 OpenAI 風格回傳形狀，讓呼叫端程式碼改動最小。 */
export type ClaudeInvokeResult = {
  choices: Array<{ message: { content: string } }>;
};

export async function invokeClaude(params: ClaudeInvokeParams, apiKey: string): Promise<ClaudeInvokeResult> {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: params.messages,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Anthropic API error ${response.status}: ${detail}`);
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");

  return { choices: [{ message: { content: text } }] };
}
