/**
 * 抓取用的最小定義：只有 screener 需要的 key/name/url。
 * 前端 screenerData.ts 裡完整的 UI 文案（note、filters、caution 等）
 * 是展示用的靜態內容，不需要讓後端相依前端套件；兩邊的 sourceUrl
 * 理論上要保持一致，如果之後在前端調整篩選條件，記得回來同步這裡。
 */
export type ScreenSource = {
  key: string;
  name: string;
  sourceUrl: string;
  /** 選填：同一組篩選條件的 Valuation 檢視（v=121）網址，用來額外抓 P/B。 */
  valuationSourceUrl?: string;
};

export const SCREEN_SOURCES: ScreenSource[] = [
  {
    key: "qualityMomentum",
    name: "中大型股獲利動能",
    sourceUrl: "https://finviz.com/screener?v=111&f=cap_midover,fa_epsqoq_pos,fa_opermargin_pos,sh_price_u50,ta_change_u3,ta_rsi_ob60",
  },
  {
    key: "microShort",
    name: "微型股高空頭動能",
    sourceUrl: "https://finviz.com/screener?v=111&f=cap_microunder%2Csh_curvol_o1000%2Csh_outstanding_u20%2Csh_price_u10%2Csh_relvol_o1.5%2Csh_short_high%2Ctad_0_close%3A%3Aclose%3Ad&ft=4&o=price",
  },
  {
    key: "newHighMomentum",
    name: "52 週新高動能",
    sourceUrl: "https://finviz.com/screener?v=111&f=sh_avgvol_o500%2Csh_relvol_o1.5%2Cta_highlow52w_nh%2Cta_perf_13wup%2Cta_rsi_nob60%2Cta_sma20_pa%2Cta_sma50_pa%2Ctad_0_close%3A%3Aclose%3Ad&ft=4&o=price",
  },
  {
    key: "megaValueQuality",
    name: "低價大型品質成長",
    sourceUrl: "https://finviz.com/screener?v=111&f=cap_mega%2Cfa_epsyoy1_o10%2Cfa_pe_u25%2Cfa_roe_o15%2Cfa_sales5years_o10%2Csh_price_u10%2Ctad_0_close%3A%3Aclose%3Ad&ft=4&o=price",
  },
  {
    key: "defensiveIncomeValue",
    name: "穩健收息與價值防禦型多頭",
    sourceUrl: "https://finviz.com/screener?v=111&f=fa_div_o3%2Cfa_opermargin_pos%2Cfa_payoutratio_u60%2Cfa_pb_u2%2Csh_instown_o50%2Csh_price_o10%2Cta_beta_u1%2Ctad_0_close%3A%3Aclose%3Ad&ft=4&o=price",
    valuationSourceUrl:
      "https://finviz.com/screener?v=121&f=fa_div_o3%2Cfa_opermargin_pos%2Cfa_payoutratio_u60%2Cfa_pb_u2%2Csh_instown_o50%2Csh_price_o10%2Cta_beta_u1%2Ctad_0_close%3A%3Aclose%3Ad&ft=4&o=price",
  },
  {
    key: "topGainers",
    name: "Top Gainers · 當日漲幅居前",
    sourceUrl: "https://finviz.com/screener?v=111&s=ta_topgainers",
  },
  {
    key: "topLosers",
    name: "Top Losers · 當日跌幅居前",
    sourceUrl: "https://finviz.com/screener?v=111&s=ta_toplosers",
  },
];

export const INSIDER_TRADING_SOURCE_URLS = {
  buy: "https://finviz.com/insidertrading?tc=1",
  sale: "https://finviz.com/insidertrading?tc=2",
} as const;

export const INSIDER_SCREEN_KEY = "insiderTrading";
