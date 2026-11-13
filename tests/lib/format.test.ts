import { describe, expect, it } from "vitest";
import { centsToInput, formatPrice, parseBrlToCents } from "@/lib/format";

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

describe("parseBrlToCents", () => {
  it.each([
    ["79,90", 7990],
    ["79.90", 7990],
    ["R$ 79,90", 7990],
    ["r$79,9", 7990],
    ["1.299,90", 129990],
    ["1.299", 129900],
    ["80", 8000],
    ["0", 0],
    ["0,00", 0],
    ["  12,5  ", 1250],
    ["1.234.567,89", 123456789],
  ])("%j → %j", (input, expected) => {
    expect(parseBrlToCents(input)).toBe(expected);
  });

  it.each(["", "   ", "abc", "-5", "79,999", "79,9,0", "1.29,90", "R$", "12,3a", "1e3", "9".repeat(30)])(
    "rejeita %j",
    (input) => {
      expect(parseBrlToCents(input)).toBeNull();
    },
  );
});

describe("centsToInput", () => {
  it.each([
    [7990, "79,90"],
    [5, "0,05"],
    [0, "0,00"],
    [129900, "1299,00"],
  ])("%j → %j", (cents, expected) => {
    expect(centsToInput(cents)).toBe(expected);
  });

  it("ida e volta com parseBrlToCents", () => {
    for (const cents of [0, 1, 99, 100, 7990, 129990]) {
      expect(parseBrlToCents(centsToInput(cents))).toBe(cents);
    }
  });

  it("rejeita valores inválidos", () => {
    expect(() => centsToInput(-1)).toThrow(RangeError);
    expect(() => centsToInput(1.5)).toThrow(RangeError);
  });
});
