import { describe, expect, it } from "vitest";
import { getRankBadgeTier, rankStocks, sortStocks } from "./stockSorting";
import type { Stock } from "./screenerData";

const stocks: Stock[] = [
  { ticker: "MID", company: "Mid Co", sector: "Technology", industry: "Software", country: "USA", marketCapLabel: "2.00B", marketCapBn: 2, pe: "18.00", price: 10, change: 2, volume: 2000 },
  { ticker: "LOW", company: "Low Co", sector: "Technology", industry: "Software", country: "USA", marketCapLabel: "1.00B", marketCapBn: 1, pe: "8.00", price: 5, change: -1, volume: 1000 },
  { ticker: "NONE", company: "None Co", sector: "Technology", industry: "Software", country: "USA", marketCapLabel: "3.00B", marketCapBn: 3, pe: "-", price: 15, change: 5, volume: 3000 },
];

describe("stock table sorting", () => {
  it("sorts change, price, and market cap in the requested direction", () => {
    expect(sortStocks(stocks, "change", "desc").map((stock) => stock.ticker)).toEqual(["NONE", "MID", "LOW"]);
    expect(sortStocks(stocks, "price", "asc").map((stock) => stock.ticker)).toEqual(["LOW", "MID", "NONE"]);
    expect(sortStocks(stocks, "marketCapBn", "desc").map((stock) => stock.ticker)).toEqual(["NONE", "MID", "LOW"]);
  });

  it("sorts P/E numerically and always keeps missing P/E at the end", () => {
    expect(sortStocks(stocks, "pe", "asc").map((stock) => stock.ticker)).toEqual(["LOW", "MID", "NONE"]);
    expect(sortStocks(stocks, "pe", "desc").map((stock) => stock.ticker)).toEqual(["MID", "LOW", "NONE"]);
  });

  it("assigns sequential rank labels after the active sort result", () => {
    const ranked = rankStocks(sortStocks(stocks, "price", "asc"));
    expect(ranked.map(({ stock, rank }) => `${rank}:${stock.ticker}`)).toEqual(["1:LOW", "2:MID", "3:NONE"]);
  });

  it("labels the first three current ranks as gold, silver, and bronze", () => {
    expect([1, 2, 3, 4].map(getRankBadgeTier)).toEqual(["gold", "silver", "bronze", null]);
  });
});
