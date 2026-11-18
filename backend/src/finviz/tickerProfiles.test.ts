import { describe, expect, it } from "vitest";
import { buildTickerProfileUrls } from "./fetchScreen";

describe("buildTickerProfileUrls", () => {
  it("去重、排序並每 20 檔切一批", () => {
    const letters = Array.from({ length: 25 }, (_, i) => `T${String.fromCharCode(65 + i)}`);
    const urls = buildTickerProfileUrls([...letters].reverse().concat(["TA", "TB"]));
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe(`https://finviz.com/screener?v=111&t=${letters.slice(0, 20).join(",")}`);
    expect(urls[1]).toBe(`https://finviz.com/screener?v=111&t=${letters.slice(20).join(",")}`);
  });
  it("沒有代碼時不發請求", () => {
    expect(buildTickerProfileUrls([])).toEqual([]);
  });
});
