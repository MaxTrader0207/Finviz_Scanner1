/**
 * 側欄「分析工具」的兩個頁面：跨視角共振、篩選績效。
 * 沿用 Market Editorial 的版面語彙（hero-panel、section-head、eyebrow、teal/copper 語意色）。
 */
import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown, CircleAlert, Landmark, Loader2 } from "lucide-react";
import "../analysisViews.css";
import { trpc } from "@/lib/trpc";
import type { Screen } from "@/lib/screenerData";
import type { InsiderTransaction } from "@/lib/insiderTrading";
import type { ScreenHistory } from "@/lib/screenHistory";
import { computeResonance } from "@/lib/resonance";

export type ToolView = "resonance" | "performance";

const formatCompactUsd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
const formatPct = (value: number | null | undefined, digits = 2) => (value === null || value === undefined ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`);
const toneOf = (value: number | null | undefined) => (value === null || value === undefined ? "" : value > 0 ? "positive" : value < 0 ? "negative" : "");

function ToolStat({ label, value, note, accent, compact = false }: { label: ReactNode; value: ReactNode; note: ReactNode; accent: string; compact?: boolean }) {
  return (
    <article className="stat-card">
      <div className={`stat-rule ${accent}`} />
      <p className="eyebrow">{label}</p>
      <p className={`stat-value${compact ? " stat-value--compact" : ""}`}>{value}</p>
      <p className="stat-note">{note}</p>
    </article>
  );
}

function ToolHero({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <section className="hero-panel tool-hero" style={{ backgroundImage: "linear-gradient(90deg, rgba(13, 28, 48, .98) 0%, rgba(13, 28, 48, .93) 55%, rgba(13, 28, 48, .82) 100%), radial-gradient(circle at 82% 40%, rgba(192,139,72,.28) 0%, rgba(192,139,72,0) 55%)" }}>
      <div className="hero-copy"><p className="eyebrow copper-text">{eyebrow}</p><h1>{title}</h1><p>{note}</p></div>
    </section>
  );
}

export function ResonanceView({ screens, histories, insider, isLive, onOpenScreen }: { screens: Screen[]; histories: Record<string, ScreenHistory>; insider: { buy: InsiderTransaction[]; sale: InsiderTransaction[] } | null; isLive: boolean; onOpenScreen: (key: string) => void }) {
  const rows = useMemo(() => computeResonance(screens, histories, insider), [screens, histories, insider]);
  const tripleCount = rows.filter((row) => row.score >= 3).length;
  return (
    <>
      <ToolHero eyebrow="CROSS-SCREEN RESONANCE" title="跨視角共振" note="同一檔股票同時出現在兩個以上的篩選視角（或同時有內部人買進），代表不同角度的條件互相印證。分數越高、連續上榜越久，訊號越強。" />
      <section className="metrics-grid" aria-label="共振摘要">
        <ToolStat accent="teal" label={<>共振股票</>} value={<>{rows.length} 檔</>} note={<>出現在 2 個以上訊號</>} />
        <ToolStat accent="copper" label={<>3 個訊號以上</>} value={<>{tripleCount} 檔</>} note={<>最強的交集</>} />
        <ToolStat accent="ink" label={<>內部人買進加持</>} value={<>{rows.filter((row) => row.insiderBuy).length} 檔</>} note={<>{insider ? "Finviz Form 4 最新快照" : "內部人資料尚未同步"}</>} />
        <ToolStat accent="teal" label={<>訊號分歧</>} value={<>{rows.filter((row) => row.hasConflict).length} 檔</>} note={<>同時有偏多與偏空訊號</>} />
      </section>
      {!isLive && <p className="tool-note"><CircleAlert size={14} /> 目前顯示的是展示用靜態資料，後端同步後會換成即時名單。</p>}
      <section className="universe-section resonance-section" aria-label="共振股票清單">
        <div className="universe-header"><div><p className="eyebrow">RESONANCE LIST</p><h2>多視角交集清單</h2></div><p>依訊號數、連續上榜天數排序</p></div>
        {rows.length ? (
          <div className="resonance-list">
            {rows.map((row) => (
              <article key={row.ticker} className={`resonance-card ${row.hasConflict ? "has-conflict" : ""}`} data-role="resonance-card">
                <div className="resonance-score" aria-label={`${row.score} 個訊號`}><strong>{row.score}</strong><small>訊號</small></div>
                <div className="resonance-main">
                  <div className="resonance-title">
                    <a className="ticker-link" href={`https://finviz.com/quote.ashx?t=${row.ticker}`} target="_blank" rel="noreferrer">{row.ticker}<ArrowUpRight size={13} /></a>
                    <span>{row.stock.company}</span>
                    {row.hasConflict && <em className="resonance-conflict">訊號分歧</em>}
                  </div>
                  <small className="resonance-meta">{row.stock.sector} · {row.stock.industry}</small>
                  <div className="resonance-hits">
                    {row.hits.map((hit) => (
                      <button key={hit.screenKey} type="button" className={`resonance-hit ${hit.bearish ? "bearish" : ""}`} onClick={() => onOpenScreen(hit.screenKey)} title={`前往「${hit.shortName}」視角`}>
                        {hit.shortName}
                        {hit.isNew ? <b className="hit-new">NEW</b> : hit.streak >= 2 ? <b>連 {hit.streak} 天</b> : null}
                      </button>
                    ))}
                    {row.insiderBuy && <span className="resonance-hit insider"><Landmark size={11} /> 內部人買進 {row.insiderBuy.count} 筆 · {formatCompactUsd(row.insiderBuy.value)}</span>}
                    {row.insiderSale && <span className="resonance-hit bearish"><Landmark size={11} /> 內部人賣出 {row.insiderSale.count} 筆 · {formatCompactUsd(row.insiderSale.value)}</span>}
                  </div>
                </div>
                <div className="resonance-price">{typeof row.stock.price === "number" && <strong>${row.stock.price.toFixed(2)}</strong>}{typeof row.stock.change === "number" && <span className={`change-pill ${row.stock.change >= 0 ? "positive" : "negative"}`}>{row.stock.change >= 0 ? "+" : ""}{row.stock.change.toFixed(2)}%</span>}</div>
              </article>
            ))}
          </div>
        ) : <div className="zero-result-card"><CircleAlert size={19} /><div><strong>今天沒有跨視角共振的股票</strong><p>各視角的名單目前沒有交集。名單每天美股收盤後更新，可以明天再回來看。</p></div></div>}
      </section>
    </>
  );
}

const HORIZON_LABELS = [
  { key: "d1", label: "1 日" },
  { key: "d5", label: "5 日" },
  { key: "d20", label: "20 日" },
] as const;

export function PerformanceView() {
  const { data, isLoading, isError } = trpc.performance.getSummary.useQuery(undefined, { staleTime: 10 * 60 * 1000, retry: 0 });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<(typeof HORIZON_LABELS)[number]["key"]>("d5");
  const screens = data?.screens ?? [];
  const totalEntries = screens.reduce((sum, screen) => sum + screen.entryCount, 0);
  const ranked = useMemo(() => [...screens].sort((a, b) => (b.horizons[horizon].excessMean ?? -Infinity) - (a.horizons[horizon].excessMean ?? -Infinity)), [screens, horizon]);
  const best = ranked.find((screen) => screen.horizons[horizon].count > 0);

  return (
    <>
      <ToolHero eyebrow="SCREEN BACKTEST" title="篩選績效追蹤" note="每檔股票「新進」某個視角的那天記一筆，追蹤之後 1／5／20 個交易日的收盤報酬，並和同期 SPY 比較，看哪個視角真的有效、哪個只是雜訊。" />
      <section className="metrics-grid" aria-label="績效摘要">
        <ToolStat accent="teal" label={<>追蹤事件</>} value={<>{totalEntries.toLocaleString("en-US")} 筆</>} note={<>{data?.trackingSince ? `自 ${data.trackingSince} 起` : "尚未開始追蹤"}</>} />
        <ToolStat accent="copper" label={<>{HORIZON_LABELS.find((item) => item.key === horizon)!.label}最佳視角</>} value={<>{best ? best.screenName : "—"}</>} note={<>{best ? `相對 SPY ${formatPct(best.horizons[horizon].excessMean)}` : "資料累積中"}</>} compact />
        <ToolStat accent="ink" label={<>比較基準</>} value={<>SPY</>} note={<>同期間 S&P 500 ETF 報酬</>} />
        <ToolStat accent="teal" label={<>進場假設</>} value={<>進榜日收盤</>} note={<>略為樂觀，實際多為隔日開盤</>} compact />
      </section>

      <section className="universe-section performance-section" aria-label="各視角績效">
        <div className="universe-header">
          <div><p className="eyebrow">FORWARD RETURNS</p><h2>各視角進榜後報酬</h2></div>
          <div className="horizon-toggle" role="group" aria-label="排序依據的持有天數">{HORIZON_LABELS.map((item) => <button key={item.key} type="button" className={horizon === item.key ? "active" : ""} onClick={() => setHorizon(item.key)}>{item.label}</button>)}</div>
        </div>
        {isLoading ? <div className="tool-loading"><Loader2 size={18} className="is-spinning" /> 載入績效資料…</div>
          : isError ? <div className="zero-result-card"><CircleAlert size={19} /><div><strong>績效資料暫時無法取得</strong><p>後端可能還沒部署這個功能，或資料庫還沒套用新的 migration。</p></div></div>
          : !totalEntries ? <div className="zero-result-card"><CircleAlert size={19} /><div><strong>還沒有累積到進榜事件</strong><p>每天同步後會自動記錄新進榜的股票，並在之後的交易日補上報酬。</p></div></div>
          : (
            <div className="performance-table">
              <div className="performance-row performance-head"><span>視角</span>{HORIZON_LABELS.map((item) => <span key={item.key} className={horizon === item.key ? "active" : ""}>{item.label}<small>平均／中位／勝率／vs SPY</small></span>)}<span /></div>
              {ranked.map((screen) => {
                const isOpen = expanded === screen.screenKey;
                return (
                  <div key={screen.screenKey} className={`performance-block ${isOpen ? "open" : ""}`}>
                    <button type="button" className="performance-row" onClick={() => setExpanded(isOpen ? null : screen.screenKey)} aria-expanded={isOpen}>
                      <span className="performance-name"><strong>{screen.screenName}</strong><small>{screen.entryCount} 筆事件</small></span>
                      {HORIZON_LABELS.map((item) => {
                        const stats = screen.horizons[item.key];
                        return (
                          <span key={item.key} className={`performance-cell ${horizon === item.key ? "active" : ""}`} data-horizon={item.label}>
                            <b className={toneOf(stats.mean)}>{formatPct(stats.mean)}</b>
                            <small>中位 {formatPct(stats.median)} · 勝率 {stats.winRate === null ? "—" : `${Math.round(stats.winRate * 100)}%`}</small>
                            <small className={`excess ${toneOf(stats.excessMean)}`}>vs SPY {formatPct(stats.excessMean)} · n={stats.count}</small>
                          </span>
                        );
                      })}
                      <span className="performance-toggle"><ChevronDown size={14} /></span>
                    </button>
                    {isOpen && (
                      <div className="performance-entries">
                        <p>最近的進榜事件（報酬為空代表還沒到該天數）</p>
                        <div className="performance-entry-grid">
                          {screen.recentEntries.map((entry) => (
                            <a key={`${entry.ticker}-${entry.sessionDate}`} className="performance-entry" href={`https://finviz.com/quote.ashx?t=${entry.ticker}`} target="_blank" rel="noreferrer">
                              <strong>{entry.ticker}</strong><small>{entry.sessionDate.slice(5).replace("-", "/")}</small>
                              <span className={toneOf(entry.ret1d)}>{formatPct(entry.ret1d, 1)}</span><span className={toneOf(entry.ret5d)}>{formatPct(entry.ret5d, 1)}</span><span className={toneOf(entry.ret20d)}>{formatPct(entry.ret20d, 1)}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        <p className="tool-note">說明：同一檔股票掉出後再次進榜會另記一筆；Top Gainers／Losers 每天大換血，樣本數會遠多於其他視角。平均數容易被小型股的極端漲跌拉動，請搭配中位數與勝率一起看。過去績效不代表未來報酬。</p>
      </section>
    </>
  );
}
