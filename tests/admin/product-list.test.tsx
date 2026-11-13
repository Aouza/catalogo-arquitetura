import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Pagination } from "@/components/admin/pagination";
import { ProductFilters } from "@/components/admin/product-filters";
import { ProductList } from "@/components/admin/product-list";
import type { AdminProductListItem } from "@/modules/products/list-products";

const categories = [
  { id: "c1", name: "Meninas", slug: "meninas" },
  { id: "c2", name: "Meninos", slug: "meninos" },
];

const item = (overrides: Partial<AdminProductListItem> = {}): AdminProductListItem => ({
  id: "p1",
  slug: "vestido-floral",
  name: "Vestido Floral",
  status: "draft",
  basePriceCents: 7990,
  categoryId: "c1",
  updatedAt: "2026-11-14T15:00:00.000Z",
  ...overrides,
});

const noop = async () => {};
const render = (items: AdminProductListItem[]) =>
  renderToStaticMarkup(
    <ProductList
      items={items}
      categories={categories}
      returnTo="/admin/produtos?q=a"
      changeStatus={noop}
      deleteProduct={noop}
    />,
  );

describe("ProductList", () => {
  it("mostra nome, endereço, preço, categoria e data", () => {
    const html = render([item()]);
    expect(html).toContain("Vestido Floral");
    expect(html).toContain("/produto/vestido-floral");
    expect(html).toMatch(/R\$\s79,90/);
    expect(html).toContain("Meninas");
    expect(html).toContain("14/11/2026");
  });

  it("mostra preço zero e 'Sem categoria'", () => {
    const html = render([item({ basePriceCents: 0, categoryId: null })]);
    expect(html).toMatch(/R\$\s0,00/);
    expect(html).toContain("Sem categoria");
  });

  it("a situação aparece como texto", () => {
    expect(render([item({ status: "draft" })])).toContain("Rascunho");
    expect(render([item({ status: "published" })])).toContain("Publicado");
    expect(render([item({ status: "archived" })])).toContain("Arquivado");
  });

  it("rascunho só pode ser publicado", () => {
    const html = render([item({ status: "draft" })]);
    expect(html).toContain("Publicar");
    expect(html).not.toContain("Tirar do ar");
    expect(html).not.toContain("Reativar");
    expect(html).not.toContain("Arquivar");
  });

  it("publicado pode ser tirado do ar ou arquivado, mas não publicado de novo", () => {
    const html = render([item({ status: "published" })]);
    expect(html).toContain("Tirar do ar");
    expect(html).toContain("Arquivar");
    expect(html).not.toContain(">Publicar<");
  });

  it("arquivado só pode ser reativado (volta como rascunho)", () => {
    const html = render([item({ status: "archived" })]);
    expect(html).toContain("Reativar");
    expect(html).not.toContain(">Publicar<");
    expect(html).not.toContain("Tirar do ar");
  });

  it("os formulários levam id, intenção e a URL de retorno", () => {
    const html = render([item()]);
    expect(html).toContain('name="id" value="p1"');
    expect(html).toContain('name="intent" value="publish"');
    expect(html).toContain('name="returnTo" value="/admin/produtos?q=a"');
  });

  it("excluir exige confirmação explicando o que será apagado", () => {
    const html = render([item()]);
    expect(html).toContain("<details");
    expect(html).toContain("Confirmar exclusão");
    expect(html).toContain("não pode ser desfeito");
  });

  it("escapa o nome do produto (sem HTML injetado)", () => {
    const html = render([item({ name: "<img src=x onerror=alert(1)>" })]);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("ProductFilters", () => {
  const render = (filters = {}) => renderToStaticMarkup(<ProductFilters filters={filters} categories={categories} />);

  it("é um formulário GET com campos rotulados", () => {
    const html = render();
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/admin/produtos"');
    expect(html).toContain("Buscar pelo nome");
    expect(html).toContain("Situação");
    expect(html).toContain("Categoria");
    expect(html).toContain("Meninas");
  });

  it("preenche os filtros atuais e oferece 'Limpar' só quando há filtro", () => {
    expect(render()).not.toContain("Limpar");
    const html = render({ query: "vestido", status: "published", categoryId: "c2" });
    expect(html).toContain('value="vestido"');
    expect(html).toContain("Limpar");
  });
});

describe("Pagination", () => {
  const render = (page: number, totalPages: number) =>
    renderToStaticMarkup(<Pagination page={page} totalPages={totalPages} filters={{ query: "a" }} />);

  it("não aparece com uma página só", () => {
    expect(render(1, 1)).toBe("");
  });

  it("primeira página: só 'Próxima'; última: só 'Anterior'; mantém os filtros", () => {
    const first = render(1, 3);
    expect(first).toContain("Próxima");
    expect(first).not.toContain("Anterior");
    expect(first).toContain("q=a");
    expect(first).toContain("pagina=2");

    const last = render(3, 3);
    expect(last).toContain("Anterior");
    expect(last).not.toContain("Próxima");
    expect(last).toContain("Página 3 de 3");
  });
});
