// 前端不會真的用到 Cloudflare D1 的執行期型別，這裡只是為了讓透過 pnpm
// workspace 匯入 backend 的 AppRouter 型別時（見 src/lib/trpc.ts），
// TypeScript 能解析到 `D1Database` 這個名稱（它出現在 backend context 的
// Env 型別裡，會隨著 tRPC 的型別結構一起被攤平檢查）。
//
// 刻意不安裝完整的 @cloudflare/workers-types 套件並整包塞進這裡的
// tsconfig「types」陣列 —— 那個套件會全域重新定義 Response / Request /
// fetch / caches 等名稱，跟瀏覽器 DOM lib 的定義衝突，導致 html2canvas /
// jsPDF 這類用到瀏覽器 DOM 型別的程式碼出現一堆不相關的型別錯誤。
declare type D1Database = unknown;
