import { describe, expect, it } from "vitest";
import { buildWatchlistCsv, buildWatchlistCsvFileName } from "./watchlistExport";

describe("自選股 CSV 匯出", () => {
  it("輸出繁體中文標題、欄位與 UTF-8 BOM", () => {
    const csv = buildWatchlistCsv([{
      ticker: "ALM",
      company: "Almonty Industries Inc",
      source: "獲利動能",
      sector: "Basic Materials",
      price: "$17.69",
      change: "+9.33%",
      marketCap: "5.10B",
      pe: "72.15",
      volume: "10.51M",
    }]);

    expect(csv.startsWith("\uFEFF代碼,公司,來源策略,產業")).toBe(true);
    expect(csv).toContain("ALM,Almonty Industries Inc,獲利動能,Basic Materials,$17.69,+9.33%,5.10B,72.15,10.51M");
  });

  it("正確逸出含逗號、雙引號與換行的欄位", () => {
    const csv = buildWatchlistCsv([{
      ticker: "ABC",
      company: "Alpha, \"Beta\"\nHoldings",
      source: "內部人資訊",
      sector: "Financial",
      price: "—",
      change: "—",
      marketCap: "—",
      pe: "—",
      volume: "—",
    }]);

    expect(csv).toContain('ABC,"Alpha, ""Beta"" Holdings",內部人資訊,Financial');
  });

  it("提供穩定的 CSV 檔名", () => {
    expect(buildWatchlistCsvFileName()).toBe("Signal-Ledger-Watchlist.csv");
  });
});
