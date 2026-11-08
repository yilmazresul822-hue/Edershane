import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  webServer: {
    command: "npm run dev -w apps/web -- --port 5173",
    port: 5173, reuseExistingServer: true,
    env: { VITE_SUPABASE_URL: "http://127.0.0.1:9", VITE_SUPABASE_ANON_KEY: "test", VITE_API_URL: "http://127.0.0.1:9" },
  },
  use: { baseURL: "http://localhost:5173" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
