import { describe, expect, it } from "vitest";
import { getStockCardMetrics } from "./stockCardMetrics";

describe("getStockCardMetrics", () => {
  it("依固定順序輸出防禦型卡片的五項指標", () => {
    expect(getStockCardMetrics({ pe: "8.36", defensiveMetrics: { dividendYield: "4.39%", payoutRatio: "36.39%", priceToBook: "1.58", beta: "0.22", snapshotSource: "Finviz" } })).toEqual([
      { label: "殖利率", value: "4.39%", isUnavailable: false },
      { label: "配息率", value: "36.39%", isUnavailable: false },
      { label: "P/B", value: "1.58", isUnavailable: false },
      { label: "P/E", value: "8.36", isUnavailable: false },
      { label: "Beta", value: "0.22", isUnavailable: false },
    ]);
  });

  it("以明確破折號表示非防禦型策略缺少的快照欄位", () => {
    expect(getStockCardMetrics({ pe: "-" })).toEqual([
      { label: "殖利率", value: "—", isUnavailable: true },
      { label: "配息率", value: "—", isUnavailable: true },
      { label: "P/B", value: "—", isUnavailable: true },
      { label: "P/E", value: "—", isUnavailable: true },
      { label: "Beta", value: "—", isUnavailable: true },
    ]);
  });
});
