# Desenho de banco de dados — proposta para migrations

**Importante:** modelo lógico para revisão; não é DDL final. Todas as FKs e constraints devem ser validadas na implementação.

**Loja única (ADR-004):** não há `catalog_id`, `catalog_members` nem slug de catálogo. Um segundo catálogo exigirá migration própria para introduzir o tenant.

| Tabela | Campos centrais | Restrições importantes |
|---|---|---|
| `store_settings` | id boolean PK default true, name, description, whatsapp_e164, instagram, address, hours, logo_path, logo_full_path, theme jsonb, updated_at | linha única (`CHECK (id)`); WhatsApp validado; nunca removida |
| `admins` | user_id uuid PK → auth.users (on delete cascade) | sem escrita via API; criada por SQL/painel |
| `categories` | id, name, slug, position | slug único |
| `products` | id, category_id nullable, slug, name, description, base_price_cents bigint, status, created_at, updated_at | slug único; base_price >= 0 |
| `product_options` | id, product_id, name, code, position | UNIQUE(product_id,code) |
| `product_option_values` | id, option_id, label, code, position | UNIQUE(option_id,code) |
| `product_variants` | id, product_id, combination_key, price_override_cents nullable, is_available, position | UNIQUE(product_id,combination_key); override >= 0 |
| `variant_option_values` | variant_id, option_value_id | PK(variant_id,option_value_id); validar produto e uma escolha por opção |
| `product_images` | id, product_id, option_value_id nullable, storage_path, alt_text, position, created_at | valor de opção deve pertencer ao produto |

## Integridade entre produtos
Referências de opções, variantes e imagens nunca podem cruzar produtos: usar FKs compostas e/ou triggers transacionais. RLS não substitui constraints de integridade.

## Autorização
`is_admin()` (`SECURITY DEFINER`, `search_path` fixo, `EXECUTE` revogado de `PUBLIC`) consulta `admins` e é usada pelas policies, evitando recursão de RLS. Leitura pública: apenas dados publicados. Escrita: somente admin.

## Combinação única
`combination_key` é uma assinatura canônica determinística dos IDs dos valores selecionados, ordenados pela opção. Ela deve ser **gerada e validada no servidor/banco**, não aceita como verdade do cliente. A atualização de opções/valores deve reconstruir a assinatura em transação. Alternativa a avaliar: função SQL que valida e grava a combinação de forma atômica.

## Índices iniciais
- `products(status,created_at DESC)`
- `products(category_id,status)`
- `product_variants(product_id,is_available)`
- `product_images(product_id,position)`
- `categories(position)`

## Regras de armazenamento
BRL em centavos com `BIGINT` e CHECK >= 0; timestamps UTC (`timestamptz`); UUIDs; não usar float para dinheiro. Slugs case-normalizados. Caminhos de imagens armazenados no banco; URL de entrega derivada conforme política de bucket.

## Política de exclusão
O admin pode excluir qualquer produto (BR-015): `DELETE` em `products` permitido só a `is_admin()`, com `ON DELETE CASCADE` para opções, valores, variantes, vínculos e imagens. A limpeza dos arquivos no Storage é responsabilidade do fluxo de mídia (EPIC 03), pois o banco não apaga objetos do Storage. `products.category_id` usa `ON DELETE SET NULL`: excluir categoria não apaga produtos. Arquivar continua sendo a alternativa que preserva o produto.

## Limites por produto (BR-017)
Triggers validam no banco: no máximo 2 opções, 20 valores (somando as opções) e 100 variantes por produto.

## Migrações
001 store_settings/admins/RLS (EPIC 01); 002 categories/products; 003 options/values/variants; 004 images; 005 funções de consistência e publicação (sequência ilustrativa, ajustar para dependências).
