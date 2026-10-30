# Setup do ambiente de desenvolvimento

## Pré-requisitos
- Node.js 24 e npm.
- Docker Desktop (somente para rodar o Supabase local).

## Primeiros passos
```bash
npm ci
cp .env.example .env.local   # preencher com os valores do Supabase local ou do projeto
npm run dev                   # http://localhost:3000
```

## Scripts
| Comando | Função |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | Verificação de tipos (TypeScript strict) |
| `npm run lint` | ESLint |
| `npm test` | Testes (Vitest) |

## Supabase local
A configuração está em `supabase/config.toml`; migrações versionadas ficam em `supabase/migrations/`.

```bash
npx supabase start    # requer Docker; mostra URL e chaves locais
npx supabase status
npx supabase stop
```

Copie `API URL` e `anon key` para `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `.env.local`. A service role key nunca deve ir para o cliente nem para variáveis `NEXT_PUBLIC_*`.

## CI
`.github/workflows/ci.yml` executa `typecheck`, `lint` e `test` em cada push na `master` e em pull requests. Antes de abrir PR, rode os três localmente.

## Catálogo fictício
Em desenvolvimento, `http://localhost:3000/demo-infantil` mostra um catálogo de exemplo (`src/modules/catalogs/fixtures/demo-catalog.ts`). Em produção a fixture não responde. A home usa `NEXT_PUBLIC_SITE_URL` como base dos metadados Open Graph.
