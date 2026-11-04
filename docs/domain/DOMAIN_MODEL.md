# Modelo de domínio

Loja única (ADR-004): não há `Catalog` nem `CatalogMember`; a configuração da loja é uma linha (`store_settings`) e administradores ficam em `admins`.

## Agregados e conceitos
- **StoreSettings:** identidade, contato e tema da loja (linha única).
- **Admin:** usuário autenticado autorizado a escrever (papel único, BR-005).
- **Category:** organização dos produtos.
- **Product:** nome, descrição, categoria, preço base, publicação, slug.
- **ProductOption:** atributo configurável de produto (`color`, `size`, ou outro).
- **ProductOptionValue:** valor pertencente a uma opção (`Azul`, `26`).
- **ProductVariant:** combinação comercial válida; disponibilidade e preço opcional.
- **VariantOptionValue:** ligação entre variação e seus valores.
- **ProductImage:** foto geral ou ligada a um valor de opção; posição e texto alternativo.

## Relações
```text
Category 1--N Product
Product 1--N ProductOption 1--N ProductOptionValue
Product 1--N ProductVariant 1--N VariantOptionValue N--1 ProductOptionValue
Product 1--N ProductImage --0..1--> ProductOptionValue
```
Excluir um produto remove em cascata opções, valores, variantes e imagens (BR-015). Excluir uma categoria não apaga produtos: eles ficam sem categoria.

## Invariantes
- Nenhuma referência entre produtos distintos (opção, valor, variante e imagem sempre do mesmo produto).
- Produto simples: exatamente uma variação padrão sem opções.
- Produto com opções: cada variação tem um valor de cada opção obrigatória.
- Uma combinação única por produto; detalhes de constraint/assinatura em DATABASE_DESIGN.
- Limites por produto: 2 opções, 20 valores, 100 variantes (BR-017).
- Imagem vinculada à cor não depende de tamanho; outros valores podem ser suportados pelo esquema.

## Exemplos
Vestido: preço base 7990; cor Rosa/Azul, tamanho 2/4; Rosa+4 override 8990; Azul+2 indisponível. Fotos gerais e fotos vinculadas a Rosa ou Azul.
Brechó: jaqueta única, uma variação padrão, sem necessidade de criar opções.

## Estados e transições
`draft -> published -> archived`; permitir `published -> draft` e `archived -> draft` mediante edição autorizada. Publicação requer nome, preço válido (zero permitido), slug, pelo menos uma variação válida e pelo menos 1 imagem (BR-016; a exigência de imagem é ativada no EPIC 03).
