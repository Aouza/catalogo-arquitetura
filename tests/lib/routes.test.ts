import { describe, expect, it } from "vitest";
import { routes } from "@/lib/routes";

describe("routes", () => {
  it("monta as URLs provisórias", () => {
    expect(routes.catalog("loja")).toBe("/loja");
    expect(routes.products("loja")).toBe("/loja/produtos");
    expect(routes.search("loja")).toBe("/loja/busca");
    expect(routes.category("loja", "bebes")).toBe("/loja/categoria/bebes");
    expect(routes.product("loja", "vestido")).toBe("/loja/produto/vestido");
  });
  it("codifica segmentos", () => {
    expect(routes.product("loja", "a/b?c")).toBe("/loja/produto/a%2Fb%3Fc");
  });
});
