import { useMemo } from "react";
import { trpc } from "./trpc";
import { screens as staticScreens, type Screen, type Stock } from "./screenerData";

const SNAPSHOT_TIME_FORMATTER = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatSnapshotAt(fetchedAt: string | Date): string {
  const date = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
  return `${SNAPSHOT_TIME_FORMATTER.format(date)} · 自動同步`;
}

export type UseScreensResult = {
  screens: Screen[];
  /** true 代表至少有一個視角已經吃到資料庫的真實同步結果，而非展示用靜態資料。 */
  isLive: boolean;
  lastSyncedAt: number | null;
  /** 尚未同步過的視角清單（仍在顯示靜態展示資料）。 */
  staleScreenKeys: string[];
};

/**
 * 取代原本對 screenerData.ts 的靜態 import：
 * - 資料庫還沒有任何成功快照時，整份沿用 screenerData.ts 的靜態資料（demo/展示用途）。
 * - 每個 screenKey 各自獨立比對：有同步過的視角換成即時資料，還沒同步過的維持靜態資料，
 *   並透過 staleScreenKeys 讓 UI 可以標示「尚未完成首次同步」。
 */
export function useScreens(): UseScreensResult {
  const { data, error } = trpc.finvizSync.getLatestSnapshots.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    retry: 1,
  });

  return useMemo(() => {
    if (error) {
      console.warn("[useScreens] Falling back to static demo data:", error);
    }

    if (!data || data.length === 0) {
      return { screens: staticScreens, isLive: false, lastSyncedAt: null, staleScreenKeys: staticScreens.map((s) => s.key) };
    }

    const byKey = new Map(data.map((snapshot) => [snapshot.screenKey, snapshot]));
    const staleScreenKeys: string[] = [];

    const merged = staticScreens.map((template): Screen => {
      const snapshot = byKey.get(template.key);
      if (!snapshot) {
        staleScreenKeys.push(template.key);
        return template;
      }
      // 內部人資訊視角的 stocks 欄位在 DB 裡是 { buy, sale } 物件而非 Stock[]，
      // 沿用既有 insiderTrading.ts 的靜態資料呈現，只更新時間戳記。
      if (template.key === "insiderTrading") {
        return { ...template, snapshotAt: formatSnapshotAt(snapshot.fetchedAt) };
      }

      let stocks = snapshot.stocks as Stock[];
      if (template.key === "defensiveIncomeValue") {
        // 後端這個視角改用 Finviz 的 Valuation 檢視抓 P/B、stockanalysis.com
        // 補殖利率/配息率/Beta，這三個都是扁平欄位；UI 原本是從 defensiveMetrics
        // 這個巢狀物件讀取，這裡轉換一下形狀。個別股票若查無資料則顯示「—」。
        stocks = stocks.map((stock) => {
          const raw = stock as Stock & { priceToBook?: string; dividendYield?: string; payoutRatio?: string; beta?: string };
          return {
            ...stock,
            defensiveMetrics: {
              dividendYield: raw.dividendYield ?? "—",
              payoutRatio: raw.payoutRatio ?? "—",
              priceToBook: raw.priceToBook ?? "—",
              beta: raw.beta ?? "—",
              snapshotSource: "Finviz",
            },
          };
        });
      }

      return {
        ...template,
        stocks,
        snapshotAt: formatSnapshotAt(snapshot.fetchedAt),
        snapshotTotal: snapshot.stockCount,
      };
    });

    const lastSyncedAt = Math.max(...data.map((snapshot) => new Date(snapshot.fetchedAt).getTime()));

    return { screens: merged, isLive: true, lastSyncedAt, staleScreenKeys };
  }, [data, error]);
}
