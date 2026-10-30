# Catálogo Digital — documentação do projeto

**Status:** planejamento / pré-implementação · **Versão:** 0.1 · **Data:** 2026-10-23

Plataforma de vitrines digitais, inicialmente para um vendedor de roupas e calçados infantis. A arquitetura prevê um segundo catálogo de brechó, sem desenvolver funcionalidades comerciais de SaaS no MVP.

## Princípios
- Catálogo, não e-commerce: não processar pedidos, pagamentos ou reservas.
- Mobile-first; conversão via link do WhatsApp com produto e seleção identificados.
- Cadastro manual inicialmente; importação CSV/XLSX futura.
- Monólito modular, com isolamento de dados entre catálogos.
- Evitar abstrações prematuras; preservar regras de negócio independentes da UI.

## Mapa de leitura
1. [PRD](docs/product/PRD.md)
2. [Escopo e jornadas](docs/product/SCOPE_AND_JOURNEYS.md)
3. [Regras de negócio](docs/domain/BUSINESS_RULES.md)
4. [Modelo de domínio](docs/domain/DOMAIN_MODEL.md)
5. [Arquitetura](docs/architecture/SYSTEM_ARCHITECTURE.md)
6. [Banco de dados](docs/architecture/DATABASE_DESIGN.md)
7. [Segurança](docs/architecture/SECURITY.md)
8. [Imagens e SEO](docs/architecture/MEDIA_AND_SEO.md)
9. [ADRs](docs/architecture/adr/)
10. [Plano de entrega](docs/delivery/IMPLEMENTATION_PLAN.md)
11. [Critérios de qualidade](docs/delivery/QUALITY_AND_TESTING.md)
12. [Pendências](docs/delivery/OPEN_QUESTIONS.md)

## Agentes de código
- [AGENTS.md](AGENTS.md): instruções comuns para agentes, incluindo Codex.
- [CLAUDE.md](CLAUDE.md): instruções de entrada para Claude Code.
- Antes de codificar: ler PRD, regras de negócio, ADRs e documento da tarefa.
- Não inventar requisitos; registrar lacunas em OPEN_QUESTIONS.md.

## Estado das decisões
**Confirmado pelo solicitante:** uso inicial para o tio; aproximadamente 100 produtos; cadastro manual; cores/tamanhos; disponibilidade sem quantidade; preço base com sobrescrita; fotos por cor; WhatsApp; divulgação por Instagram/WhatsApp; segundo catálogo potencial para brechó.

**Proposta técnica adotada como baseline, sujeita a validação:** multi-catálogo na mesma aplicação, Next.js, Supabase, variações com opções configuráveis, RLS, URLs por slug.
