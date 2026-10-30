# Desenho de banco de dados — proposta para migrations

**Importante:** modelo lógico para revisão; não é DDL final. Todas as FKs e constraints devem ser validadas na implementação.

| Tabela | Campos centrais | Restrições importantes |
|---|---|---|
| `catalogs` | id uuid PK, slug, name, description, whatsapp_e164, logo_path, created_at | slug único; WhatsApp validado |
| `catalog_members` | catalog_id, user_id, role | PK(catalog_id,user_id); role permitido |
| `categories` | id, catalog_id, name, slug, position | UNIQUE(catalog_id,slug) |
| `products` | id, catalog_id, category_id nullable, slug, name, description, base_price_cents bigint, status, created_at, updated_at | UNIQUE(catalog_id,slug); base_price >= 0; categoria do mesmo catálogo |
| `product_options` | id, product_id, name, code, position | UNIQUE(product_id,code) |
| `product_option_values` | id, option_id, label, code, position | UNIQUE(option_id,code) |
| `product_variants` | id, product_id, combination_key, price_override_cents nullable, is_available, position | UNIQUE(product_id,combination_key); override >= 0 |
| `variant_option_values` | variant_id, option_value_id | PK(variant_id,option_value_id); validar produto e uma escolha por opção |
| `product_images` | id, product_id, option_value_id nullable, storage_path, alt_text, position, created_at | valor de opção deve pertencer ao produto |

## Integridade entre catálogos
Preferir FKs compostas e/ou triggers transacionais para garantir `products.catalog_id = categories.catalog_id`; referências de opções, variantes e imagens nunca podem cruzar produtos. RLS não substitui constraints de integridade.

## Combinação única
`combination_key` é uma assinatura canônica determinística dos IDs dos valores selecionados, ordenados pela opção. Ela deve ser **gerada e validada no servidor/banco**, não aceita como verdade do cliente. A atualização de opções/valores deve reconstruir a assinatura em transação. Alternativa a avaliar: função SQL que valida e grava a combinação de forma atômica.

## Índices iniciais
- `products(catalog_id,status,created_at DESC)`
- `products(catalog_id,category_id,status)`
- `product_variants(product_id,is_available)`
- `product_images(product_id,position)`
- `catalog_members(user_id,catalog_id)`
- `categories(catalog_id,position)`

## Regras de armazenamento
BRL em centavos com `BIGINT` e CHECK >= 0; timestamps UTC (`timestamptz`); UUIDs; não usar float para dinheiro. Slugs case-normalizados. Caminhos de imagens armazenados no banco; URL de entrega derivada conforme política de bucket.

## Política de exclusão
Preferir arquivar produto; exclusão definitiva e limpeza de mídia precisam de fluxo explícito, autorização e tratamento de referências. Cascatas somente após revisão.

## Migrações sugeridas
001 catalogs/members; 002 categories/products; 003 options/values/variants; 004 images; 005 RLS/policies/indexes; 006 functions de consistência e publicação (sequência ilustrativa, ajustar para dependências).
