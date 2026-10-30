# Modelo de domínio

## Agregados e conceitos
- **Catalog:** identidade, slug, contato, marca; controla limites de acesso.
- **CatalogMember:** vínculo usuário/catálogo e papel (`owner`, `editor` propostos).
- **Category:** organização dentro de catálogo.
- **Product:** nome, descrição, categoria, preço base, publicação, slug.
- **ProductOption:** atributo configurável de produto (`color`, `size`, ou outro).
- **ProductOptionValue:** valor pertencente a uma opção (`Azul`, `26`).
- **ProductVariant:** combinação comercial válida; disponibilidade e preço opcional.
- **VariantOptionValue:** ligação entre variação e seus valores.
- **ProductImage:** foto geral ou ligada a um valor de opção; posição e texto alternativo.

## Relações
```text
Catalog 1--N CatalogMember N--1 AuthUser
Catalog 1--N Category
Catalog 1--N Product
Category 1--N Product
Product 1--N ProductOption 1--N ProductOptionValue
Product 1--N ProductVariant 1--N VariantOptionValue N--1 ProductOptionValue
Product 1--N ProductImage --0..1--> ProductOptionValue
```

## Invariantes
- Nenhuma referência entre produtos/catálogos distintos.
- Produto simples: exatamente uma variação padrão sem opções.
- Produto com opções: cada variação tem um valor de cada opção obrigatória.
- Uma combinação única por produto; detalhes de constraint/assinatura em DATABASE_DESIGN.
- Imagem vinculada à cor não depende de tamanho; outros valores podem ser suportados pelo esquema.

## Exemplos
Vestido: preço base 7990; cor Rosa/Azul, tamanho 2/4; Rosa+4 override 8990; Azul+2 indisponível. Fotos gerais e fotos vinculadas a Rosa ou Azul.
Brechó: jaqueta única, uma variação padrão, sem necessidade de criar opções.

## Estados e transições
`draft -> published -> archived`; permitir `published -> draft` e `archived -> draft` mediante edição autorizada. Publicação requer nome, preço válido, slug e pelo menos uma variação válida. Exigência de imagem na publicação: **pendente de confirmação**.
