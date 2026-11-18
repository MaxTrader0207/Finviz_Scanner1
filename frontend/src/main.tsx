import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
if (!apiBaseUrl && import.meta.env.PROD) {
  console.error("[Signal Ledger] VITE_API_BASE_URL is not set — API calls will fail. See frontend/.env.example.");
}

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    // 新加的、非核心的查詢（目前是每日進出名單）獨立送出、不跟主資料合併成同一個批次：
    // 後端比前端晚部署、或這支 API 出錯時，只會讓那一區塊不顯示，
    // 不會連帶讓整個批次失敗、把篩選結果打回展示用的靜態資料。
    splitLink({
      condition: (op) => op.path === "finvizSync.getScreenHistory",
      true: httpLink({ url: `${apiBaseUrl ?? ""}/trpc`, transformer: superjson }),
      false: httpBatchLink({
        url: `${apiBaseUrl ?? ""}/trpc`,
        transformer: superjson,
        // 這個工具是單人使用，公開讀取端點不需要帶認證資訊；
        // 管理操作（finvizSync.triggerNow）目前設計成從別處（curl / CI）用
        // Authorization: Bearer <ADMIN_TOKEN> 呼叫，不走這個前端 client。
      }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
