import { describe, expect, it } from "vitest";
import { routes } from "@/lib/routes";

describe("routes", () => {
  it("monta as URLs públicas da loja única", () => {
    expect(routes.home()).toBe("/");
    expect(routes.products()).toBe("/produtos");
    expect(routes.search()).toBe("/busca");
    expect(routes.category("bebes")).toBe("/categoria/bebes");
    expect(routes.product("vestido")).toBe("/produto/vestido");
  });
  it("codifica segmentos", () => {
    expect(routes.product("a/b?c")).toBe("/produto/a%2Fb%3Fc");
  });
});
