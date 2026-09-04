import { createTRPCReact } from "@trpc/react-query";
// 型別透過 pnpm workspace 直接引用 backend 套件（見根目錄 pnpm-workspace.yaml
// 與本套件 package.json 的 devDependencies）。只匯入型別，不會把 backend
// 的執行期程式碼打包進前端。
import type { AppRouter } from "@signal-ledger/backend/dist-types/router";

export const trpc = createTRPCReact<AppRouter>();
