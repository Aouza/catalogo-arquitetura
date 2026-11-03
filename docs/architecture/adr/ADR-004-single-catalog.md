# ADR-004 — Loja única, catálogo na raiz

**Status:** aceito (2026-11-03). Substitui a ADR-001.

## Contexto
A ADR-001 previa uma aplicação multi-catálogo, com slug na URL e isolamento por catálogo. O escopo foi reduzido: o foco é um único catálogo (o do tio), sem segundo catálogo, subdomínios ou SaaS.

## Decisão
- Uma loja por instalação. O catálogo público vive na raiz: `/`, `/produtos`, `/busca`, `/categoria/{categorySlug}`, `/produto/{productSlug}`. O admin fica em `/admin`.
- Não há slug de catálogo nem subdomínio. Resolve a OQ-15.
- Os dados da loja (nome, tema, WhatsApp, Instagram) serão uma única linha de configuração, a detalhar no EPIC 01.
- Sem multi-tenant: a RLS distingue público (lê o publicado) de admin autenticado (escreve). O critério "admin A não acessa dados de B" deixa de valer.

## Consequências
+ Modelo, RLS e rotas mais simples; menos testes de isolamento.
- Um segundo catálogo exigirá migration para introduzir o tenant e rotas novas. Aceito, pois está fora do MVP.
- Todo link continua centralizado em `lib/routes.ts`, o que limita o custo de mudar a estrutura de URLs.
