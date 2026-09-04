import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { invokeClaude } from "../llm";
import { withEdgeCache } from "../cache";

const SUMMARY_CACHE_TTL_SECONDS = 15 * 60;
const MODEL = "claude-haiku-4-5-20251001";

export const stockSummaryInput = z.object({
  ticker: z.string().regex(/^[A-Z.]{1,10}$/),
  company: z.string().min(1).max(160),
  sector: z.string().min(1).max(80),
  industry: z.string().min(1).max(120),
  country: z.string().min(1).max(80),
  marketCapLabel: z.string().min(1).max(30),
  pe: z.string().min(1).max(30),
  price: z.number().finite().nonnegative(),
  change: z.number().finite(),
  volume: z.number().int().nonnegative(),
  screenName: z.string().min(1).max(80),
  screenFilters: z.array(z.string().min(1).max(80)).min(1).max(10),
  sourceUrl: z.string().url(),
  snapshotAt: z.string().min(1).max(80),
});

type StockSummaryInput = z.infer<typeof stockSummaryInput>;

const summaryList = z.preprocess(
  (value) => (typeof value === "string" ? [value] : value),
  z.array(z.string().min(1).max(220)).min(1).max(3)
);

const aiPayloadSchema = z.object({
  operatingHighlights: summaryList,
  technicalRead: summaryList,
  riskNote: z.string().min(1).max(260),
  dataBasis: z.string().min(1).max(220),
});

export type StockSummary = z.infer<typeof aiPayloadSchema> & {
  sourceUrl: string;
  generatedAt: number;
  isFallback: boolean;
};

const formatVolume = (volume: number) => volume.toLocaleString("en-US");

export const parseAiSummaryContent = (content: unknown) => {
  const raw =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((part) => (typeof part === "object" && part && "text" in part && typeof part.text === "string" ? part.text : "")).join("")
        : "";
  const normalized = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");
  return aiPayloadSchema.parse(JSON.parse(normalized));
};

export const buildFallbackSummary = (input: StockSummaryInput): StockSummary => ({
  operatingHighlights: [
    `${input.ticker} 位於「${input.screenName}」篩選視角；本次資料所對應的條件包含 ${input.screenFilters.slice(0, 3).join("、")}。`,
    `此快照顯示市值 ${input.marketCapLabel}、本益比 ${input.pe}；資料未包含公司最新財報內容、指引或事件，因此不對營運趨勢作額外推論。`,
  ],
  technicalRead: [
    `快照價格為 $${input.price.toFixed(2)}，單日變動 ${input.change >= 0 ? "+" : ""}${input.change.toFixed(2)}%。`,
    `本次成交量為 ${formatVolume(input.volume)}；它只反映資料擷取時的市場活動度，無法單獨確認趨勢延續。`,
  ],
  riskNote: "此摘要僅根據目前 Dashboard 傳入的篩選快照產生，不能取代完整財報、技術指標序列或個人化投資判斷。",
  dataBasis: `Finviz Screener 快照（${input.snapshotAt}）與 Dashboard 內的篩選條件、價格及成交量欄位。`,
  sourceUrl: input.sourceUrl,
  generatedAt: Date.now(),
  isFallback: true,
});

const cacheKeyFor = (input: StockSummaryInput) =>
  ["grounded-v2", input.ticker, input.screenName, input.price, input.change, input.volume, input.marketCapLabel, input.pe].join("|");

export const isGroundedSummary = (summary: z.infer<typeof aiPayloadSchema>, input: StockSummaryInput) => {
  const allText = [...summary.operatingHighlights, ...summary.technicalRead, summary.riskNote, summary.dataBasis].join(" ");
  const recommendationPattern = /買進|賣出|推薦|目標價|預測報酬|保證報酬/;
  if (recommendationPattern.test(allText)) return false;
  if (input.pe === "-" && /(本益比|P\/?E).{0,18}(負值|負數|虧損|獲利狀況)/i.test(allText)) return false;
  return true;
};

async function createSummary(input: StockSummaryInput, apiKey: string): Promise<StockSummary> {
  return withEdgeCache({
    cacheKey: `summary:${cacheKeyFor(input)}`,
    ttlSeconds: SUMMARY_CACHE_TTL_SECONDS,
    compute: async () => {
      try {
        const response = await invokeClaude(
          {
            model: MODEL,
            maxTokens: 1000,
            system:
              "你是謹慎的繁體中文市場研究助理。只能根據使用者提供的單一 Finviz 篩選快照與篩選條件寫摘要。不得編造近期財報、新聞、事件、目標價、技術指標、趨勢或買賣建議；當資料不足時必須明說『資料不足』。技術面僅可描述價格、單日變動、成交量及明示的篩選條件。所有內容必須是中性研究語氣，且不提供投資推薦。若本益比欄位是「-」，只能說『本益比未提供』，嚴禁寫成負值、虧損或任何獲利結論。只輸出一個有效 JSON 物件，不要 Markdown 或程式碼區塊；欄位必須是 operatingHighlights（字串陣列，1 至 3 項）、technicalRead（字串陣列，1 至 3 項）、riskNote（字串）及 dataBasis（字串）。",
            messages: [
              {
                role: "user",
                content: `請為以下資料產生 JSON 摘要。\n\n公司：${input.company}（${input.ticker}）\n產業：${input.sector}／${input.industry}／${input.country}\n快照：${input.snapshotAt}\n市值：${input.marketCapLabel}\n本益比：${input.pe}\n價格：$${input.price.toFixed(2)}\n單日變動：${input.change >= 0 ? "+" : ""}${input.change.toFixed(2)}%\n成交量：${formatVolume(input.volume)}\n篩選視角：${input.screenName}\n篩選條件：${input.screenFilters.join("；")}\n資料來源：${input.sourceUrl}`,
              },
            ],
          },
          apiKey
        );

        const content = response.choices?.[0]?.message.content;
        if (!content) throw new Error("AI model returned no summary content");
        const parsed = parseAiSummaryContent(content);
        if (!isGroundedSummary(parsed, input)) throw new Error("AI summary included unsupported investment or valuation claims");
        return { ...parsed, sourceUrl: input.sourceUrl, generatedAt: Date.now(), isFallback: false };
      } catch (error) {
        console.warn(`[AI Summary] Falling back to snapshot-only summary for ${input.ticker}:`, error);
        return buildFallbackSummary(input);
      }
    },
  });
}

export const stockSummaryRouter = router({
  generate: publicProcedure.input(stockSummaryInput).mutation(async ({ input, ctx }) => createSummary(input, ctx.env.ANTHROPIC_API_KEY)),
});
