# Home da vitrine (`/{catalogSlug}`) — design

**Status:** aprovado em conversa (seções 1–3), aguardando revisão desta spec · **Data:** 2026-10-30

## 1. Objetivo e escopo

Entregar a página inicial pública de um catálogo, `/{catalogSlug}`, para visitantes que chegam por links do Instagram e WhatsApp, usando dados fictícios (fixture) e sem Supabase nem login. A home deve ser mobile-first, acessível, tematizável por catálogo e pronta para trocar a fixture por dados reais sem alterar componentes.

**Fontes:** PRD (RF-01, RF-02), `docs/design/Guia_Design_Catalogo_v1_2.docx` (seções 01–03, 06 e 08) e `docs/design/approved-composite-v2.png` (referência inspiracional, não pixel-perfect). Em divergência, valem as regras de negócio, depois o texto do guia, depois a imagem.

**Dentro do escopo:** rota `/{catalogSlug}`; header, busca (formulário), hero opcional, faixa de categorias, grade de produtos, rodapé; tema por catálogo com validação de contraste; estados loading, erro, vazio e 404; metadados Open Graph; testes e verificação visual.

**Fora do escopo:** listagem de categoria, resultados de busca, página de produto, admin, Supabase, autenticação, carrossel, favoritos, carrinho, swatches no card, tema escuro, upload de fontes por loja. A raiz `/` não muda.

**Do mockup, não implementar:** marca "mimô", segundo banner terracota, indicadores de carrossel, swatches no card, "Novidades" sem ordenação por data de publicação. Marca, preços e fotos do mockup são ilustrativos.

## 2. Arquitetura

```
src/
  app/[catalogSlug]/
    page.tsx   error.tsx   not-found.tsx   # sem layout.tsx e sem loading.tsx (ver "Rota e Cache Components")
  components/
    ui/          # Button, Chip, Container, Skeleton, ícones (sem conhecimento de domínio)
    storefront/  # SiteHeader, CategoryDrawer(client), SearchField, Hero, CategoryStrip,
                 # ProductCard, ProductGrid, SiteFooter, EmptyState, ImagePlaceholder, PriceDisplay
  modules/catalogs/
    types.ts                       # CatalogHomeView
    queries/get-catalog-home.ts    # única função de leitura da home
    theme/                         # tokens, themeToStyle, validateTheme
    fixtures/                      # catálogo fictício
    reserved-slugs.ts              # admin, api, _next
  lib/
    routes.ts    # único lugar que monta URLs
    format.ts    # BRL em centavos com espaço não separável
    whatsapp.ts  # validação E.164 e link wa.me sem texto
```

Regras de fronteira:
- `ui/` não conhece domínio. `storefront/` recebe apenas props prontas para exibição e não sabe a origem dos dados.
- `page.tsx` só orquestra: busca a view, compõe componentes, não tem estilo próprio.
- Componentes client limitados à gaveta do menu mobile (`<dialog>`, fecha com Esc, devolve o foco). O restante é Server Component.
- O admin futuro usará `components/admin/` com tema neutro próprio.

### Dados

`getCatalogHome(slug): CatalogHomeView | null` retorna `null` para slug inexistente ou reservado; a página responde 404.

`CatalogHomeView`: loja (`slug`, `name`, `description`, `logoUrl?`, `whatsappE164?`, `instagram?`, `address?`, `hours?`), `theme`, `hero?` (título, texto, imagem opcional), `categories[]` (`slug`, `name`, `imageUrl?`), `productsOrder` (`"published_at"` ou `"default"`) e `products[]` (`slug`, `name`, `basePriceCents`, `imageUrl?`, `imageAlt`, `isAvailable`).

Preços em centavos, inteiros. `isAvailable` é derivado de existir ao menos uma variação disponível (BR-023, BR-027). A fixture só responde fora de produção (`NODE_ENV !== "production"`); em produção, sem Supabase, nenhum catálogo existe.

Leitura pública com seleção explícita de campos e apenas produtos `published` (BR-011); a fixture contém também um produto `draft`, que `getCatalogHome` deve excluir, para testar a regra desde já.

### Rota e Cache Components

`cacheComponents` e `partialPrefetching` estão ativos. `params` de segmento dinâmico é dado de runtime: só pode ser lido dentro de `<Suspense>`, e `generateStaticParams` não pode retornar lista vazia (em produção a fixture está desligada, então não há slugs para listar). Por isso:
- `page.tsx` é síncrona e renderiza `<Suspense fallback={<HomeSkeleton />}>` em volta de um componente async que lê `params`, chama `getCatalogHome` e renderiza `CatalogHome` (que contém o `ThemeScope`). Não há `layout.tsx` async; o skeleton é o fallback do Suspense.
- `generateMetadata` lê `params` e chama `getCatalogHome` (metadados dinâmicos em stream; bots recebem render completo).
- Slug inexistente chama `notFound()` depois do início do stream: a UI de 404 é exibida com `noindex`, mas o status HTTP permanece `200` (limitação documentada do Next com Cache Components). Os testes verificam o `null` de `getCatalogHome` e a UI de 404, não o status.

### Rotas

Todo link sai de `lib/routes.ts` (`catalogPath`, `categoryPath`, `productPath`, `searchPath`, `productsPath`). Os caminhos são provisórios e as páginas de destino não existem nesta entrega. Os links apontam para as rotas futuras; a decisão de estrutura de URLs (conflito registrado em OQ-15) muda apenas esse arquivo.

## 3. Tema

Tokens semânticos com valor por catálogo; componentes usam apenas o nome.

- `globals.css` define os padrões do guia em `:root` (`--theme-*`) e um bloco `@theme inline` que os expõe como utilitários do Tailwind v4: `bg-bg`, `bg-surface`, `bg-surface-subtle`, `text-fg`, `text-fg-muted`, `bg-action`, `bg-action-hover`, `text-brand`, `bg-accent`, `text-accent-strong`, `border-border`, `border-border-strong`. Nomes do guia, exceto `color.text` → `fg` e `color.text-muted` → `fg-muted`.
- Por catálogo: 12 cores, família de fonte (título e interface, dentre as carregadas), logo e imagens editoriais. Fixos no sistema: escala tipográfica, espaçamento (escala de 4 px do Tailwind), raios (10/14/18 px), alvos de toque e movimento.
- Fontes: DM Sans (títulos) e Inter (interface) via `next/font`.
- `themeToStyle(theme)` gera as variáveis `--theme-*`; o `layout.tsx` as injeta num wrapper renderizado no servidor, sem flash nem JavaScript. Tema escuro fora do escopo.
- Padrões globais: anel de foco `:focus-visible` (2 px de `action`, afastamento de 2 px) e `prefers-reduced-motion` desativando transições.

### Validação de contraste

`validateTheme(theme)` aplica a fórmula WCAG 2.x e verifica hexadecimais válidos e:

| Par | Mínimo |
|---|---|
| `fg` sobre `bg` | 4,5:1 |
| `fg-muted` sobre `bg` e sobre `surface` | 4,5:1 |
| `fg` sobre `surface-subtle` | 4,5:1 |
| branco sobre `action`, `action-hover` e `accent-strong` | 4,5:1 |
| `border-strong` sobre `bg` | 3:1 |

Medido em 2026-10-30 com a paleta padrão: 13,17 / 4,82 e 5,11 / 12,26 / 5,06, 6,48 e 5,43 / 3,33. Todos passam e batem com o guia.

**Restrição de uso:** `fg-muted` sobre `surface-subtle` mede 4,48:1 (abaixo de 4,5). Não usar texto secundário sobre essa superfície. `brand` (3,87:1 com branco) só em ícones e textos ≥ 24 px; `accent` (3,0:1) só decorativo.

### Guardas

Um teste varre `src/components` e `src/app` e falha ao encontrar cor hexadecimal ou `[#...]` em classe.

## 4. Componentes

| Componente | Comportamento |
|---|---|
| `SiteHeader` | Logo ou, sem imagem, nome da loja em texto; categorias em gaveta (mobile) e links (desktop); atalho de WhatsApp só com número válido. |
| `SearchField` | `<form>` GET para `searchPath`, campo `q`, label acessível, 16 px, alvo ≥ 44 px, placeholder "Buscar produtos...". |
| `Hero` | Opcional e estático. Texto fora da imagem (empilhado no mobile, lado a lado no desktop); CTA secundário "Explorar produtos". Imagem 4:5 no mobile, 16:9 no desktop. |
| `CategoryStrip` | Círculos 1:1 com nome, rolagem horizontal com snap, fallback neutro com inicial. |
| `ProductCard` | Card inteiro clicável; imagem 4:5; nome em até 2 linhas (`type.label`); preço; selo textual "Indisponível" quando `isAvailable` é falso. Sem swatches nem favoritos. |
| `ProductGrid` | 2 colunas (320–599 px), 3 (600–1023), 4 (≥ 1024); margem 16 px no mobile, máximo 1200 px. Título "Novidades" se `productsOrder = "published_at"`, senão "Produtos"; "Ver todos" aponta para `productsPath`. |
| `SiteFooter` | Obrigatório. Nome, WhatsApp, Instagram, endereço e horário; só itens configurados. |
| `EmptyState` | "Novidades chegando em breve. Fale com a gente pelo WhatsApp." com contato quando houver. |
| `ImagePlaceholder`, `PriceDisplay` | Placeholder editorial neutro com proporção reservada; preço em BRL pt-BR com espaço não separável e largura reservada. |

Imagens com `next/image`, dimensões reservadas, lazy loading abaixo da primeira dobra e prioridade na primeira imagem visível. A fixture usa placeholders (sem fotos do mockup).

## 5. Estados, acessibilidade e metadados

- Esqueleto da home como fallback do Suspense. `error.tsx`: "Não conseguimos carregar esta página." com "Tentar novamente". `not-found.tsx`: 404 genérico.
- Ausências opcionais: sem hero, categorias sobem sem lacuna; sem imagem, placeholder; sem WhatsApp, atalho some; sem categorias, a faixa some; sem produtos, `EmptyState`.
- Landmarks `header`/`main`/`footer`, link "pular para o conteúdo", um `h1` por página, alt descrevendo peça e cor (não a criança), tudo operável por teclado, alvos ≥ 44 px, conteúdo utilizável a 200% de zoom.
- `generateMetadata`: título, descrição e Open Graph (logo, quando existir) com o nome da loja; `robots` coerente com catálogo existente.
- Textos de interface em pt-BR; nenhum texto de marca fixo no código.

## 6. Testes e verificação

**Unitários (Vitest):** `formatPrice` (inclui zero e valores grandes); `validateTheme` (paleta padrão passa; paleta ruim falha apontando o token; hexadecimal inválido); `themeToStyle`; `getCatalogHome` (existente, inexistente, reservado, `draft` excluído, bloqueio em produção); link do WhatsApp (válido, inválido, ausente); `routes`; guarda de hexadecimal.

**Renderização:** `react-dom/server` em ambiente node (sem jsdom): a home renderiza com dados completos e com todos os opcionais ausentes; imagens têm alt e links têm nome.

**Visual:** servidor de desenvolvimento, comparação com a referência em 320, 360 e desktop (sem overflow horizontal), teclado e foco na gaveta.

**Portões:** `typecheck`, `lint`, `test` e `build` passam; CI verde na `master`. LCP, CLS e INP (metas do guia) ficam como verificação posterior, não bloqueiam esta entrega.

## 7. Critérios de aceite

- `/{slug}` de catálogo fictício renderiza todas as seções do item 4 com tema aplicado; slug inexistente ou reservado exibe a UI de 404 com `noindex` (status HTTP 200 por causa do stream).
- Duas colunas legíveis a 320 px, preços visíveis, imagens 4:5, sem overflow horizontal.
- Nenhuma cor hexadecimal em componentes; paleta padrão passa em `validateTheme`.
- Nenhum recurso de e-commerce, favoritos ou conta de usuário final.
- Todas as URLs geradas por `lib/routes.ts`.
- Documentação atualizada: guia e referência em `docs/design/`, `AGENTS.md` e `OPEN_QUESTIONS.md`.

## 8. Riscos e decisões pendentes

- **OQ-15 (URLs):** o guia propõe subdomínio por loja e `/p/slug-id`; a arquitetura documentada usa `/{catalogSlug}/produto/{productSlug}`. Sem impacto na home graças a `lib/routes.ts`; decidir antes das rotas de produto.
- **Fonte dos títulos:** DM Sans (decisão provisória do guia, pendência 1); o mockup usa serifada. Trocar é mudança de token.
- **Nome e logo reais** da primeira loja (OQ-01): a fixture usa nome fictício configurável.
- **`cacheComponents` ativo:** a leitura é síncrona e estática com a fixture; ao introduzir o Supabase, adotar `use cache` com tags por catálogo (fora desta entrega).
- **Gaveta `<dialog>`:** é o único trecho com comportamento dependente de navegador; coberto na verificação manual de teclado.
