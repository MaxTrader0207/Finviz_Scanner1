# Signal Ledger

Finviz 篩選視角儀表板。前後端拆成兩個獨立部署的套件：

```
signal-ledger/
├── frontend/   React + Vite 靜態網站 → 部署到 GitHub Pages
├── backend/    Cloudflare Worker（tRPC + D1）→ 部署到 Cloudflare
└── .github/workflows/   CI + 兩邊各自的部署 workflow
```

不再依賴任何 Manus 平台特有的東西（OAuth、Heartbeat cron、Forge Storage、
LLM 代理）——這是從原本的 Manus WebDev 專案拆出來、改寫成一般 GitHub 專案
能用的架構。

## 架構

```
使用者瀏覽器
  │
  ▼
GitHub Pages（frontend/，靜態檔案，wouter 前端路由）
  │  fetch → https://<your-worker>.workers.dev/trpc
  ▼
Cloudflare Worker（backend/，tRPC + D1）
  │
  ├─ scheduled()：Cloudflare Cron Trigger 每日觸發 Finviz 同步
  │     → 抓取 7 個 screener 視角 + 內部人交易頁
  │     → 寫入 D1（finviz_screen_snapshots / finviz_sync_runs）
  │     → 失敗會發 Discord/Slack webhook 通知（選填）
  │
  ├─ finvizSync.getLatestSnapshots：前端讀取即時資料
  ├─ priceHistory.*：即時抓 Yahoo Finance 股價，Cloudflare Cache API 快取 15 分鐘
  └─ stockSummary.generate：呼叫 Anthropic API 產生個股摘要（有防幻覺 grounding 檢查）
```

## 跨套件型別共享

`frontend` 透過 pnpm workspace 引用 `backend` 的 tRPC `AppRouter` 型別，維持
端到端型別安全。但 backend 用到 Cloudflare Workers 專屬的全域型別
（`D1Database`、`caches.default`），跟 frontend 用的瀏覽器 DOM lib 型別直接
放在同一個 tsc 專案裡會衝突，所以流程是：

1. `backend` 用 `pnpm run build:types` 產生純型別宣告檔到 `backend/dist-types/`
   （不含任何函式實作內容，所以不會把 Workers 專屬的執行期型別帶進來）。
2. `frontend/src/lib/trpc.ts` 只匯入 `@signal-ledger/backend/dist-types/router`
   這個編譯後的宣告檔，而不是 backend 的原始碼。
3. `backend/dist-types` 沒有被提交進 git（是產生物），所以**跑
   `pnpm run check` 或 `pnpm --filter frontend check` 之前要先跑一次
   `pnpm run build:types`**——根目錄的 `pnpm run check` 已經自動處理好順序，
   CI 的 `ci.yml` 也是。

## 本機開發

```bash
pnpm install

# 一個 terminal 跑後端（預設 http://localhost:8787）
cp backend/.dev.vars.example backend/.dev.vars   # 填入 ADMIN_TOKEN / ANTHROPIC_API_KEY
pnpm run dev:backend

# 另一個 terminal 跑前端
cp frontend/.env.example frontend/.env            # 預設已指向 localhost:8787
pnpm run dev:frontend
```

## 部署後端（Cloudflare Workers）

```bash
cd backend
pnpm dlx wrangler login

# 建立 D1 資料庫，把印出來的 database_id 貼進 wrangler.toml
pnpm dlx wrangler d1 create signal-ledger-db

# 套用 migration（見 drizzle/ 底下的 SQL；本機測試用 --local，正式環境用 --remote）
pnpm run db:migrate:remote

# 設定 secrets（不要寫進 wrangler.toml 或任何會進 git 的檔案）
wrangler secret put ADMIN_TOKEN
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put ALERT_WEBHOOK_URL   # 選填

pnpm run deploy
```

之後想接 GitHub Actions 自動部署（`.github/workflows/deploy-backend.yml`
已經寫好），去 repo **Settings → Secrets and variables → Actions** 加：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 部署前端（GitHub Pages）

1. Repo **Settings → Pages → Source** 選 "GitHub Actions"。
2. **Settings → Secrets and variables → Actions → Variables** 加一個
   `API_BASE_URL`，值是你部署好的 Worker 網址（例如
   `https://signal-ledger-backend.<你的子網域>.workers.dev`）。
3. 推到 `main` 分支，`.github/workflows/deploy-frontend.yml` 會自動用正確的
   base path（`/<repo 名稱>/`）build 並部署。

## 手動觸發一次同步（不用等每日 cron）

```bash
curl -X POST https://<your-worker>.workers.dev/trpc/finvizSync.triggerNow \
  -H "Authorization: Bearer <你的 ADMIN_TOKEN>" \
  -H "Content-Type: application/json"
```

## 上線前務必做的事

`backend/src/finviz/parseScreen.ts` 與 `parseInsiderTrading.ts` 裡的 HTML
表格選擇器，是依照這個專案既有的欄位定義推斷寫的，**沒有對照真實 Finviz
頁面驗證過**。正式排程同步前，請：

1. 打開瀏覽器 DevTools 對照 `https://finviz.com/screener?v=111...` 目前的
   表格結構，確認選擇器與欄位順序仍然成立。
2. 把驗證過的真實頁面存一份成
   `backend/src/finviz/__fixtures__/finviz-screener-sample.html`，取代
   `parseScreen.test.ts` 裡手工寫的示意用 fixture，這樣以後 Finviz 改版時
   測試才能真的保護你。
3. 用 `finvizSync.triggerNow` 手動跑一次，確認 D1 裡的
   `finviz_screen_snapshots` 有正確資料再放著讓每日 cron 跑。

## 授權

MIT，見 [LICENSE](./LICENSE)。
