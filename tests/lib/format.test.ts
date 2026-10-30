import { describe, expect, it } from "vitest";
import { formatPrice } from "@/lib/format";

describe("formatPrice", () => {
  it("formata centavos em BRL pt-BR com espaço não separável", () => {
    expect(formatPrice(14990)).toBe("R$ 149,90");
  });
  it("trata zero como preço válido", () => {
    expect(formatPrice(0)).toBe("R$ 0,00");
  });
  it("formata milhares", () => {
    expect(formatPrice(123456789)).toBe("R$ 1.234.567,89");
  });
  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("rejeita %s", (v) => {
    expect(() => formatPrice(v)).toThrow(RangeError);
  });
});
