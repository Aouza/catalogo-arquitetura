import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoryList } from "@/components/admin/category-list";
import { categoriesUrl, readCategoryFlash } from "@/modules/categories/flash";
import type { AdminCategory } from "@/modules/categories/manage-categories";

const category = (overrides: Partial<AdminCategory> = {}): AdminCategory => ({
  id: "c1",
  name: "Meninas",
  slug: "meninas",
  position: 0,
  productCount: 3,
  ...overrides,
});

const noop = async () => {};
const render = (items: AdminCategory[]) =>
  renderToStaticMarkup(
    <CategoryList items={items} renameCategory={noop} moveCategory={noop} deleteCategory={noop} />,
  );

describe("CategoryList", () => {
  it("mostra nome, endereço e quantidade de produtos", () => {
    const html = render([category()]);
    expect(html).toContain("Meninas");
    expect(html).toContain("/categoria/meninas");
    expect(html).toContain("3 produtos");
  });

  it("usa singular e o texto de nenhum produto", () => {
    expect(render([category({ productCount: 1 })])).toContain("1 produto");
    expect(render([category({ productCount: 0 })])).toContain("Nenhum produto");
  });

  it("desativa Subir na primeira e Descer na última", () => {
    const html = render([category({ id: "a", name: "A" }), category({ id: "b", name: "B" })]);
    const buttons = [...html.matchAll(/<button[^>]*>(Subir|Descer)<\/button>/g)].map((match) => match[0]);
    expect(buttons).toHaveLength(4);
    // 1ª: Subir desativado; 2ª: Descer ativado; 3ª: Subir ativado; 4ª: Descer desativado.
    expect(buttons[0]).toContain(`disabled=""`);
    expect(buttons[1]).not.toContain(`disabled=""`);
    expect(buttons[2]).not.toContain(`disabled=""`);
    expect(buttons[3]).toContain(`disabled=""`);
  });

  it("a exclusão pede confirmação e avisa que os produtos ficam sem categoria", () => {
    const html = render([category()]);
    expect(html).toContain("<details");
    expect(html).toContain("Confirmar exclusão");
    expect(html).toContain("ficarão sem categoria");
  });

  it("a exclusão de categoria vazia diz que nenhum produto usa", () => {
    expect(render([category({ productCount: 0 })])).toContain("Nenhum produto usa essa categoria");
  });
});

describe("avisos de categoria", () => {
  it("lê só códigos conhecidos da URL", () => {
    expect(readCategoryFlash({ aviso: "created" })).toEqual({ kind: "notice", message: "Categoria criada." });
    expect(readCategoryFlash({ erro: "category_exists" })?.kind).toBe("error");
    expect(readCategoryFlash({ aviso: "<script>alert(1)</script>" })).toBeNull();
    expect(readCategoryFlash({ erro: "toString" })).toBeNull();
    expect(readCategoryFlash({})).toBeNull();
  });

  it("monta a URL de retorno com o código", () => {
    expect(categoriesUrl({ aviso: "deleted" })).toBe("/admin/categorias?aviso=deleted");
    expect(categoriesUrl({ erro: "invalid_name" })).toBe("/admin/categorias?erro=invalid_name");
  });
});
