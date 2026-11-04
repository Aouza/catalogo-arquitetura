// Roda os testes de banco/RLS contra o Supabase local.
// Lê URL e chaves de `supabase status -o env` (a service role fica só neste processo de teste).
import { spawnSync } from "node:child_process";

const status = spawnSync("npx", ["supabase", "status", "-o", "env"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (status.status !== 0) {
  console.error("Supabase local não está rodando. Execute `npx supabase start` (requer Docker).");
  process.exit(1);
}

const values = Object.fromEntries(
  status.stdout
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const env = {
  ...process.env,
  SUPABASE_URL: values.API_URL,
  SUPABASE_ANON_KEY: values.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
};

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Não foi possível ler API_URL/ANON_KEY/SERVICE_ROLE_KEY de `supabase status -o env`.");
  process.exit(1);
}

const run = spawnSync("npx", ["vitest", "run", "--config", "vitest.db.config.ts"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
process.exit(run.status ?? 1);
