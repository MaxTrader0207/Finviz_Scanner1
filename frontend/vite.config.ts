import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// GitHub Pages 把專案部署在 https://<user>.github.io/<repo>/ 這種子路徑下，
// 所以 build 時要設定對應的 base path。本機開發（vite/vite preview）維持 "/"。
// GitHub Actions 的部署 workflow 會設定 VITE_BASE_PATH=/<repo>/。
const basePath = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
});
