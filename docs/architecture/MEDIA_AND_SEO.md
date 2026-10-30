# Mídia, compartilhamento e SEO

## Mídia
- Upload de várias imagens por produto, com ordenação e texto alternativo.
- Imagem geral: `option_value_id = null`.
- Imagem de cor: `option_value_id` aponta para valor `color` do próprio produto.
- Galeria: imagens específicas da cor selecionada primeiro; imagens gerais como fallback.
- Evitar duplicar imagens para tamanhos; salvar paths de Storage e gerar URLs na camada de apresentação.
- Definir limites iniciais propostos: até 10 imagens/produto, 5 MB/arquivo; validar com usuário e orçamento.
- Gerar variantes otimizadas via componente de imagem e política de formatos; verificar compatibilidade de host/CDN.
- Exclusão: evitar órfãos, usar rotina idempotente e tratar falha entre banco e Storage.

## SEO e compartilhamento
- Renderização indexável para páginas publicadas.
- Title/description por catálogo e produto; canonical; sitemap apenas para URLs públicas publicadas; robots coerente.
- Open Graph e Twitter Card com imagem apropriada para prévia em WhatsApp/Instagram.
- Produtos em rascunho/arquivados não devem constar do sitemap; evitar indexação indevida.
- URLs legíveis por slug e compartilháveis diretamente.
- Dados estruturados `Product` podem ser avaliados depois, evitando declarar disponibilidade ou oferta de forma enganosa.

## WhatsApp
Construir URL de contato usando número em formato internacional e mensagem percent-encoded. Incluir nome do produto, atributos selecionados, preço exibido e link canônico. Não afirmar reserva, pedido ou compra. Oferecer feedback se não houver variação disponível.
