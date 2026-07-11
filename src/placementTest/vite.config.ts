import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 하위 경로 배포 대응.
// - 기존 서비스의 하위 URL(예: https://도메인/leveltest/)로 마운트할 때 base를 그 경로로 설정.
// - VITE_BASE 환경변수로 덮어쓸 수 있음(기본 "/leveltest/"). 루트 배포면 "/" 로 주면 됨.
const BASE = process.env.VITE_BASE || "/levelTest/";
const API_TO = process.env.VITE_API_TARGET || "http://localhost:4000";

export default defineConfig({
  base: BASE,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 하위 경로(base) 아래 /api 요청 → Express(4000)로. base 접두는 떼고 전달.
      [`${BASE}api`]: { target: API_TO, rewrite: (p) => p.replace(BASE.replace(/\/$/, ""), "") },
      // 루트로 부를 때(base "/")도 동작하도록 유지
      "/api": API_TO,
    },
  },
});
