# Questões em aberto — não presumir respostas

| ID | Pergunta | Impacto | Sugestão inicial |
|---|---|---|---|
| OQ-01 | Nome real do catálogo, domínio e WhatsApp? | Identidade/URLs | Configuráveis |
| OQ-02 | ~~Fotos obrigatórias para publicar?~~ **Resolvida (BR-016):** publicar exige ao menos 1 foto; a regra é ativada no EPIC 03, quando as imagens existirem. | Validação | — |
| OQ-03 | ~~Preço zero?~~ **Resolvida:** preço é obrigatório e zero é permitido (`base_price_cents >= 0`, BR-013). | Domínio/UI | — |
| OQ-04 | ~~Imagens de rascunho: privadas ou públicas?~~ **Resolvida:** bucket privado; a foto só é legível pelo público enquanto o produto estiver publicado e a foto cadastrada. | Segurança/Storage | — |
| OQ-05 | ~~Papéis administrativos~~ **Resolvida (BR-005):** um único papel `admin`, criado fora do app. | RLS | — |
| OQ-06 | ~~Exclusão definitiva?~~ **Resolvida (BR-015):** o admin pode excluir qualquer produto; arquivar continua disponível. | Integridade | — |
| OQ-07 | ~~Limites por produto~~ **Resolvida (BR-017):** no máximo 2 opções, 20 valores e 100 variantes, validados no banco. | UX/performance | — |
| OQ-08 | O visitante pode clicar no WhatsApp sem selecionar tamanho/cor? | UX | Exigir combinação válida |
| OQ-09 | Produto esgotado aparece na listagem ou fica oculto? | Vitrine | Mostrar com selo indisponível |
| OQ-10 | Busca por texto entra no MVP ou P1? | Escopo | P1 |
| OQ-11 | Categoria pode ter subcategorias? | Banco/UI | Não no MVP |
| OQ-12 | Quais dados de contato e identidade serão públicos? | Privacidade | Apenas os escolhidos pelo lojista |
| OQ-13 | ~~Formato e limites de imagens?~~ **Resolvida:** até 10 fotos por produto, 5 MB por arquivo, JPEG/PNG/WebP (validado pelo conteúdo do arquivo). | Custos | — |
| OQ-14 | Variações podem ter SKU/código interno? | Cadastro/importação | Campo opcional futuro |
| OQ-15 | ~~Estrutura de URLs~~ **Resolvida (ADR-004):** loja única, catálogo na raiz, `/produto/{productSlug}`. | Rotas, SEO | — |

## Processo
Resolver itens de impacto estrutural antes das migrations relevantes. Registrar novas decisões em ADR quando alterarem arquitetura ou domínio.
