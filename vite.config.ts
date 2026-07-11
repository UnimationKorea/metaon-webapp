import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const bffOrigin = process.env.VITE_BFF_ORIGIN || "http://127.0.0.1:4100";
const devPort = Number(process.env.VITE_DEV_PORT || 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    port: devPort,
    proxy: {
      "/api": {
        target: bffOrigin,
        changeOrigin: true
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts"
  }
});
