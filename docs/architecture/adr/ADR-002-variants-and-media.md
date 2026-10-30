# ADR-002 — Opções configuráveis, variantes e imagens por cor

**Status:** baseline acordado

## Contexto
Produtos infantis têm tamanhos e cores; preços podem variar por combinação; imagens mudam por cor. Brechó pode ter peça única.

## Decisão
Opções configuráveis por produto; valores de opção; variantes com combinações válidas e preço sobrescrito opcional; fotos gerais ou associadas a valor de opção (prioritariamente cor); produto simples com variante padrão.

## Consequências
+ Flexibilidade sem replicar fotos por tamanho; suporte a produtos simples.
- Integridade e UX de geração de combinações mais complexas; exigir constraints e transações.
