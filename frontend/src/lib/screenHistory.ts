import { trpc } from "./trpc";

export type ScreenHistory = {
  sessionDate: string | null;
  previousSessionDate: string | null;
  newTickers: string[];
  dropped: Array<{ ticker: string; company: string }>;
  streaks: Record<string, number>;
  sessionsAvailable: number;
};

export type ListingBadge = { isNew: boolean; streak: number; streakCapped: boolean };

/** 每日進出名單 + 連續上榜天數；後端還沒部署這支 API 時安靜地回傳空物件，不影響主畫面。 */
export function useScreenHistories(): Record<string, ScreenHistory> {
  const { data } = trpc.finvizSync.getScreenHistory.useQuery(undefined, {
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 0,
  });
  return (data as Record<string, ScreenHistory> | undefined) ?? {};
}

export function getListingBadge(history: ScreenHistory | undefined, ticker: string): ListingBadge | null {
  if (!history) return null;
  const streak = history.streaks[ticker];
  if (!streak) return null;
  return {
    isNew: history.newTickers.includes(ticker),
    streak,
    streakCapped: streak >= history.sessionsAvailable && history.sessionsAvailable > 1,
  };
}

/** 「11/17」這種短日期，用在「與 11/14 相比」的說明文字。 */
export function formatSessionDate(date: string | null): string {
  if (!date) return "—";
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}
