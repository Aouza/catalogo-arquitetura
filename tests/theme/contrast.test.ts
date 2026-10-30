import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/modules/catalogs/theme/contrast";

describe("contrastRatio", () => {
  it("preto sobre branco é 21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });
  it("cores iguais dão 1 e a ordem dos argumentos não importa", () => {
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(contrastRatio("#292D2A", "#FAF8F4")).toBeCloseTo(contrastRatio("#FAF8F4", "#292D2A"), 5);
  });
  it("bate com o valor medido do guia (fg sobre bg ≈ 13,17)", () => {
    expect(contrastRatio("#292D2A", "#FAF8F4")).toBeCloseTo(13.17, 1);
  });
});
