# Instruções para agentes (Codex / Claude Code / outros)

## Fontes de verdade, por prioridade
1. `docs/product/PRD.md` e `docs/product/SCOPE_AND_JOURNEYS.md` (objetivos e escopo).
2. `docs/domain/BUSINESS_RULES.md` e `docs/domain/DOMAIN_MODEL.md` (comportamento e invariantes).
3. `docs/architecture/adr/` (decisões aceitas).
4. `docs/design/Guia_Design_Catalogo_v1_2.docx` (UI/UX e tokens; a imagem `approved-composite-v2.png` é inspiracional, vale o texto do guia).
5. Demais documentos de arquitetura e implementação.
6. Código e testes existentes (verificar divergências; não presumir que código antigo prevalece).

## Regras de trabalho
- Não implementar checkout, carrinho, pagamentos, reserva ou estoque quantitativo.
- Sempre filtrar operações e leituras administrativas pelo catálogo autorizado; jamais confiar em `catalog_id` do cliente.
- Tratar `price_override_cents = 0` como preço zero válido; somente `null` herda preço base.
- Uma variação identifica uma combinação válida de opções; não gerar combinações inexistentes na vitrine.
- Imagens de cor são associadas ao valor de opção; não duplicar por tamanho.
- Nunca colocar chaves de serviço Supabase no cliente nem contornar RLS em endpoints públicos.
- Escrever migrações versionadas e testes para regras alteradas.
- Trabalhar em etapas pequenas: apresentar plano, arquivos afetados, testes e possíveis migrações.
- Se houver decisão em aberto, perguntar ou registrar em `docs/delivery/OPEN_QUESTIONS.md` antes de assumir.
- Não criar código ou migrações só porque a documentação contém exemplos ilustrativos.

## Definition of Done
Funcionalidade com critérios de aceitação atendidos, validação server-side, autorização testada, estados vazios/erro/loading, responsividade, testes adequados e documentação atualizada.

## Organização sugerida
`src/app` (rotas), `src/modules/{catalogs,products,categories,media}` (domínio/aplicação/infra), `src/components`, `src/lib`, `supabase/migrations`, `tests`.

## Convenções
TypeScript strict; nomes de código em inglês; textos de UI em pt-BR; moeda BRL em centavos; slugs estáveis por catálogo; datas UTC em armazenamento; tratamento de erros sem vazamento de detalhes internos.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
