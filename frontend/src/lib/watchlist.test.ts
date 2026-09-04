import { describe, expect, it } from "vitest";
import { clearWatchlistTickers, parseWatchlist, parseWatchlistSources, toggleWatchlistTicker } from "./watchlist";

describe("自選股本機保存", () => {
  it("解析有效資料並去除重複、空值與大小寫差異", () => {
    expect(parseWatchlist('["alm", "ALM", "", "bp"]')).toEqual(["ALM", "BP"]);
  });

  it("忽略損壞或非陣列的本機資料", () => {
    expect(parseWatchlist("not-json")).toEqual([]);
    expect(parseWatchlist('{"ticker":"ALM"}')).toEqual([]);
  });

  it("可加入及移除單一代碼", () => {
    expect(toggleWatchlistTicker([], "alm")).toEqual(["ALM"]);
    expect(toggleWatchlistTicker(["ALM", "BP"], "ALM")).toEqual(["BP"]);
  });

  it("可清空所有已保存代碼且不改動原始陣列", () => {
    const current = ["ALM", "BP"];
    expect(clearWatchlistTickers()).toEqual([]);
    expect(current).toEqual(["ALM", "BP"]);
  });

  it("解析自選股加入來源並忽略損壞或無效資料", () => {
    expect(parseWatchlistSources('{"alm":"獲利動能","RSG":"內部人資訊","":"忽略","BP":0}')).toEqual({ ALM: "獲利動能", RSG: "內部人資訊" });
    expect(parseWatchlistSources("not-json")).toEqual({});
    expect(parseWatchlistSources('["ALM"]')).toEqual({});
  });
});
