import { describe, expect, it } from "vitest";
import { readFlash, safeReturnTo, withFlash } from "@/modules/products/flash";
import { listHref, parseListParams } from "@/modules/products/list-params";
import { escapeLike } from "@/modules/products/list-products";

const UUID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

describe("parseListParams", () => {
  it("sem parâmetros: sem filtros, página 1", () => {
    expect(parseListParams({})).toEqual({ query: undefined, status: undefined, categoryId: undefined, page: 1 });
  });

  it("lê busca, situação, categoria e página", () => {
    expect(parseListParams({ q: "  vestido ", situacao: "published", categoria: UUID, pagina: "3" })).toEqual({
      query: "vestido",
      status: "published",
      categoryId: UUID,
      page: 3,
    });
  });

  it("ignora valores inválidos", () => {
    expect(
      parseListParams({ q: "   ", situacao: "apagado", categoria: "nao-uuid", pagina: "-2" }),
    ).toEqual({ query: undefined, status: undefined, categoryId: undefined, page: 1 });
    expect(parseListParams({ pagina: "abc" }).page).toBe(1);
    expect(parseListParams({ pagina: "1e9" }).page).toBe(1);
    expect(parseListParams({ pagina: "99999" }).page).toBe(1);
  });

  it("usa o primeiro valor quando o parâmetro se repete e limita o tamanho da busca", () => {
    expect(parseListParams({ situacao: ["draft", "published"] }).status).toBe("draft");
    expect(parseListParams({ q: "a".repeat(500) }).query).toHaveLength(80);
  });
});

describe("listHref", () => {
  it("sem filtros é a própria lista; página 1 não aparece", () => {
    expect(listHref({})).toBe("/admin/produtos");
    expect(listHref({ page: 1 })).toBe("/admin/produtos");
  });

  it("preserva os filtros e codifica a busca", () => {
    const href = listHref({ query: "calça & blusa", status: "draft", categoryId: UUID, page: 2 });
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/admin/produtos");
    expect(url.searchParams.get("q")).toBe("calça & blusa");
    expect(url.searchParams.get("situacao")).toBe("draft");
    expect(url.searchParams.get("categoria")).toBe(UUID);
    expect(url.searchParams.get("pagina")).toBe("2");
  });
});

describe("escapeLike", () => {
  it("trata %, _ e \\ como texto comum", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(escapeLike("vestido")).toBe("vestido");
  });
});

describe("safeReturnTo (sem redirecionamento para fora)", () => {
  it.each([
    ["/admin/produtos", "/admin/produtos"],
    ["/admin/produtos?q=a&pagina=2", "/admin/produtos?q=a&pagina=2"],
  ])("aceita %s", (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/admin/produtos",
    "//evil.example",
    "/admin",
    "/admin/produtos-outros",
    "/admin/produtos//evil.example",
    "/admin/produtos?x=\\evil",
    "/admin/produtos\r\nSet-Cookie: a=b",
    "",
    null,
    42,
  ])("rejeita %j e volta para a lista", (input) => {
    expect(safeReturnTo(input)).toBe("/admin/produtos");
  });
});

describe("withFlash / readFlash", () => {
  it("acrescenta o aviso mantendo os filtros e trocando aviso anterior", () => {
    const href = withFlash("/admin/produtos?q=a&erro=forbidden", { aviso: "published" });
    const url = new URL(href, "http://x");
    expect(url.searchParams.get("q")).toBe("a");
    expect(url.searchParams.get("aviso")).toBe("published");
    expect(url.searchParams.has("erro")).toBe(false);
  });

  it("não aceita retorno fora da lista", () => {
    expect(withFlash("https://evil.example", { erro: "not_found" })).toBe("/admin/produtos?erro=not_found");
  });

  it("lê só códigos conhecidos, nunca texto livre", () => {
    expect(readFlash({ aviso: "published" })).toEqual({ kind: "notice", message: "Produto publicado." });
    expect(readFlash({ erro: "incomplete_product" })).toMatchObject({ kind: "error" });
    expect(readFlash({ aviso: "<script>alert(1)</script>" })).toBeNull();
    expect(readFlash({ erro: "constructor" })).toBeNull();
    expect(readFlash({ aviso: "toString" })).toBeNull();
    expect(readFlash({})).toBeNull();
  });
});
