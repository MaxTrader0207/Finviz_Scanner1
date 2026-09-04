import type { Stock } from "./screenerData";

export type StockCardMetric = {
  label: "殖利率" | "配息率" | "P/B" | "P/E" | "Beta";
  value: string;
  isUnavailable: boolean;
};

export function getStockCardMetrics(stock: Pick<Stock, "pe" | "defensiveMetrics">): StockCardMetric[] {
  const defensive = stock.defensiveMetrics;
  const valueOrUnavailable = (value: string | undefined) => ({ value: value && value !== "-" ? value : "—", isUnavailable: !value || value === "-" });

  return [
    { label: "殖利率", ...valueOrUnavailable(defensive?.dividendYield) },
    { label: "配息率", ...valueOrUnavailable(defensive?.payoutRatio) },
    { label: "P/B", ...valueOrUnavailable(defensive?.priceToBook) },
    { label: "P/E", ...valueOrUnavailable(stock.pe) },
    { label: "Beta", ...valueOrUnavailable(defensive?.beta) },
  ];
}
