# ADR-001 — Uma aplicação multi-catálogo

**Status:** proposta aceita como baseline (validar antes da primeira migration)

## Contexto
Catálogo inicial do tio; potencial segundo catálogo de brechó da mãe. Evitar forks de código e evitar custo de SaaS completo.

## Decisão
Uma aplicação e um banco com entidade `catalogs`, associação de membros e isolamento por catálogo via RLS e constraints.

## Consequências
+ Reuso de UI, infraestrutura e regras; segundo catálogo mais barato de lançar.
- Segurança multi-catálogo precisa de testes rigorosos; operações exigem escopo explícito.

## Alternativas
Dois deploys independentes; boilerplate copiado; SaaS completo. Rejeitados para o MVP.
