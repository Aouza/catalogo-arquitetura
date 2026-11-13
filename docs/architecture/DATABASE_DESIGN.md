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
| `product_option_values` | id, option_id, product_id (denormalizado), label, code, position | UNIQUE(option_id,code); FK composta (option_id,product_id) |
| `product_variants` | id, product_id, combination_key, price_override_cents nullable, is_available, position | UNIQUE(product_id,combination_key); override >= 0 |
| `variant_option_values` | variant_id, option_value_id, product_id, option_id (os dois últimos preenchidos por trigger a partir do valor) | PK(variant_id,option_value_id); UNIQUE(variant_id,option_id); FKs compostas impedem cruzar produtos; sem UPDATE |
| `product_images` | id, product_id, option_value_id nullable, storage_path, alt_text, position, created_at | valor de opção deve pertencer ao produto |

## Combinação das variantes
`combination_key` é calculada por trigger (nunca vem do cliente): ids dos valores vinculados, ordenados e separados por vírgula; `''` identifica a variante padrão de produto simples. Cada vínculo inserido ou removido recalcula a chave, e `UNIQUE(product_id, combination_key)` rejeita duplicatas (BR-022). Consequência: uma variante sem vínculos já ocupa a chave `''`, então as variantes de um produto com opções devem ser completadas uma a uma (inserir variante, inserir seus vínculos, próxima variante). Inserir em lote várias variantes vazias falha; o caso de uso deve ser sequencial e transacional. Completude (um valor por opção) e variante padrão única são verificadas na publicação (ver "Regras de publicação"). O preço efetivo (BR-024) é calculado na aplicação.

## Integridade entre produtos
Referências de opções, variantes e imagens nunca podem cruzar produtos: FKs compostas (`product_id` denormalizado) e triggers. `product_id` e `option_id` de opções, valores e variantes são imutáveis após a criação. RLS não substitui constraints de integridade.

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

## Regras de publicação (BR-016, BR-021)
`product_publication_issues(product_id)` devolve as pendências (`no_variants`, `option_without_values`, `incomplete_variants`); lista vazia = publicável. Nome, slug e preço já são garantidos por constraints de `products`. **Foto não é exigida ainda:** entra no EPIC 03 acrescentando `no_images` nessa função.

Constraint triggers `DEFERRABLE INITIALLY DEFERRED` em `products`, `product_options`, `product_option_values`, `product_variants` e `variant_option_values` revalidam no COMMIT todo produto `published`, por qualquer caminho de escrita (inclusive service role). Consequências:
- Não é possível publicar produto inválido, nem deixar inválido um produto já publicado (ex.: excluir a última variante ou um vínculo).
- Dentro de uma transação, estados intermediários são permitidos; o resultado final precisa ser válido, senão a transação inteira é desfeita.
- Fora de uma função SQL, cada chamada do PostgREST é uma transação própria. Por isso a edição estrutural de produto publicado deve usar `save_product_structure`.
- Excluir o produto (cascata) não dispara erro de validação.

## Edição transacional da estrutura
`save_product_structure(p_product_id, p_options jsonb, p_variants jsonb)` (SECURITY INVOKER, só `authenticated`, exige `is_admin()`): sincroniza opções, valores e variantes de um produto numa única transação, inclusive publicado, sem despublicar.
- Opções e valores são casados por `code`; variantes pelo conjunto de valores. Quem permanece mantém o mesmo id (as fotos de cor do EPIC 03 apontam para o valor de opção, e não podem ser perdidas numa edição).
- O que não está no payload é removido (cascata para valores e vínculos). Uma variante cuja combinação muda é recriada.
- Payload: `options: [{code, name, position?, values: [{code, label, position?}]}]`; `variants: [{values: {optionCode: valueCode}, price_override_cents?, is_available?, position?}]`. Produto simples: `options: []` e uma variante com `values: {}`.
- Rejeita payload malformado, códigos duplicados, combinação duplicada, variante incompleta ou com valor desconhecido; os limites de BR-017 e a validação de publicação do COMMIT continuam valendo.

## Política de exclusão
O admin pode excluir qualquer produto (BR-015): `DELETE` em `products` permitido só a `is_admin()`, com `ON DELETE CASCADE` para opções, valores, variantes, vínculos e imagens. A limpeza dos arquivos no Storage é responsabilidade do fluxo de mídia (EPIC 03), pois o banco não apaga objetos do Storage. `products.category_id` usa `ON DELETE SET NULL`: excluir categoria não apaga produtos. Arquivar continua sendo a alternativa que preserva o produto.

## Limites por produto (BR-017)
Triggers validam no banco: no máximo 2 opções, 20 valores (somando as opções) e 100 variantes por produto.

## Migrações
20261104120000 store_settings/admins/RLS (EPIC 01); 20261105100000 categories/products; 20261113100000 options/values/variants; 20261113200000 regras de publicação e `save_product_structure` (EPIC 02). Próxima: imagens (EPIC 03).
