import { describe, expect, it } from "vitest";
import { routes } from "@/lib/routes";

describe("routes", () => {
  it("monta as URLs públicas da loja única", () => {
    expect(routes.home()).toBe("/");
    expect(routes.products()).toBe("/produtos");
    expect(routes.search()).toBe("/busca");
    expect(routes.category("bebes")).toBe("/categoria/bebes");
    expect(routes.product("vestido")).toBe("/produto/vestido");
    expect(routes.login()).toBe("/login");
    expect(routes.admin()).toBe("/admin");
    expect(routes.adminProducts()).toBe("/admin/produtos");
    expect(routes.adminProductNew()).toBe("/admin/produtos/novo");
    expect(routes.adminProduct("abc")).toBe("/admin/produtos/abc");
    expect(routes.adminProductOptions("abc")).toBe("/admin/produtos/abc/opcoes");
    expect(routes.adminProductPhotos("abc")).toBe("/admin/produtos/abc/fotos");
    expect(routes.adminProductPublish("abc")).toBe("/admin/produtos/abc/publicar");
  });
  it("codifica segmentos", () => {
    expect(routes.product("a/b?c")).toBe("/produto/a%2Fb%3Fc");
  });
});
