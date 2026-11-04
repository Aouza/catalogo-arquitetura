# Identidade visual — Family Store Moda

**Status:** decidida em conversa (2026-11-03). Complementa o guia `Guia_Design_Catalogo_v1_2.docx`; onde divergirem sobre nome e logo, vale este documento. O mockup `approved-composite-v2.png` usa o nome provisório "mimo" e serve só como referência de layout e clima.

## Marca
- **Nome:** Family Store Moda. **Segmento:** moda infantil (roupas e calçados). Loja única (ADR-004).
- **Tom:** acolhedor e afetivo, mas claro: preço, tamanho e disponibilidade sempre visíveis.
- **Texto do hero:** "Pequenos estilos. Grandes descobertas." / "Moda infantil para todas as fases da infância."

## Paleta e tipografia (mantidas do guia v1.2)
- Fundo `#FAF8F4`, texto `#292D2A`, ação `#5E7462`, marca `#718775`, destaque `#C98470` (texto sobre fundo claro: `#9E5643`).
- DM Sans nos títulos e Inter no texto. Cantos arredondados (10/14/18 px).

## Logo
- **Cabeçalho (opção A):** "Family Store" em destaque, "MODA" pequeno e espaçado embaixo. Sálvia escuro `#4F6353`, detalhe em terracota. SVG transparente, versão horizontal (desktop) e compacta (celular, altura 32 px; validar legibilidade).
- **Avatar e favicon (opção B):** monograma "FS". SVG, PNG 1080×1080 (Instagram/WhatsApp) e 512×512 (ícone). Legível em 16×16.

## Imagens a produzir
| Imagem | Formato | Observações |
|---|---|---|
| Logo A | SVG | Horizontal e compacto |
| Monograma B / favicon | SVG + PNG 1080 e 512 | |
| Hero | JPG/WebP 2400×1350 (desktop) e 1600×2000 (celular), ≤ ~300 KB | Crianças, luz natural, tons terrosos; sujeito no centro; área limpa ao lado do texto |
| Imagem de compartilhamento (OG) | PNG/JPG 1200×630 | Prévia do link no WhatsApp/Instagram; ainda não implementada |
| Categorias (opcional) | 400×400 | Podem ser recortes de fotos de produto |
| Produtos | Retrato 4:5, mín. 1200×1500 | Fotos reais; não gerar com IA |

## Pendências
- Logo, @ do Instagram e WhatsApp reais do lojista (hoje fictícios na fixture).
- Aprovar o logo (legibilidade a 32 px) antes de integrá-lo.

## Arquivos de imagem no projeto (2026-11-03)
- `public/images/logo/logo.png` (completo, com "MODA") e `logo-compact.png` (sem "MODA", usado no cabeçalho: a 32 px o "MODA" fica ilegível). Só PNG por enquanto; SVG fica para depois.
- `public/images/hero/hero.webp`: 16:9. No celular (4:5) o enquadramento usa `object-position: 70%` para manter as duas crianças.
- `public/images/placeholders/*.webp`: silhuetas de roupa na paleta, só para visualizar a grade enquanto não há fotos reais (geradas por script, sem relação com produtos reais).
- `public/images/categories/*.webp`: quadrados 400 px com fundo transparente, exibidos como imagens (sem círculo). Os cantos pretos e halos dos originais foram removidos.
- Originais em alta resolução ficam em `design-source/` (ignorado pelo git).
