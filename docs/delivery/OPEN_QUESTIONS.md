# Questões em aberto — não presumir respostas

| ID | Pergunta | Impacto | Sugestão inicial |
|---|---|---|---|
| OQ-01 | Nome real do catálogo, domínio e WhatsApp? | Identidade/URLs | Configuráveis |
| OQ-02 | Fotos são obrigatórias para publicar? | Validação | Recomendado ao menos 1 |
| OQ-03 | Produtos sem preço ou com preço zero são permitidos? | Domínio/UI | Exigir preço; decidir zero |
| OQ-04 | Como tratar imagens de rascunho: privadas ou públicas não indexadas? | Segurança/Storage | Preferir privadas até publicação |
| OQ-05 | Quais papéis administrativos são necessários no MVP? | RLS | Um owner inicialmente |
| OQ-06 | Exclusão definitiva de produtos será permitida? | Integridade | Arquivar inicialmente |
| OQ-07 | Máximo de opções/valores/combinações por produto? | UX/performance | Limites pequenos e configuráveis |
| OQ-08 | O visitante pode clicar no WhatsApp sem selecionar tamanho/cor? | UX | Exigir combinação válida |
| OQ-09 | Produto esgotado aparece na listagem ou fica oculto? | Vitrine | Mostrar com selo indisponível |
| OQ-10 | Busca por texto entra no MVP ou P1? | Escopo | P1 |
| OQ-11 | Categoria pode ter subcategorias? | Banco/UI | Não no MVP |
| OQ-12 | Quais dados de contato e identidade serão públicos? | Privacidade | Apenas os escolhidos pelo lojista |
| OQ-13 | Formato e limites de imagens? | Custos | Proposta 10 fotos / 5 MB |
| OQ-14 | Variações podem ter SKU/código interno? | Cadastro/importação | Campo opcional futuro |
| OQ-15 | Estrutura de URLs: subdomínio por loja e `/p/slug-id` (guia de design) ou `/{catalogSlug}/produto/{productSlug}` (arquitetura)? | Rotas, SEO, multi-loja | Decidir antes das rotas de produto; links centralizados em `lib/routes.ts` |

## Processo
Resolver itens de impacto estrutural antes das migrations relevantes. Registrar novas decisões em ADR quando alterarem arquitetura ou domínio.
