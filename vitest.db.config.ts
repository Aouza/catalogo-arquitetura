import path from "node:path";
import { defineConfig } from "vitest/config";

// Testes de banco/RLS: exigem `npx supabase start` e as variáveis de tests/db/env.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
