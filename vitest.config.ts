import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/setup/next-cache.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    // Testes de banco exigem Supabase local: `npm run test:db`.
    exclude: ["tests/db/**", "node_modules/**"],
  },
});
