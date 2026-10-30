import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const roots = ["src/components", "src/app"];

function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name))
    .map((e) => path.join(e.parentPath, e.name));
}

describe("componentes não usam cores hexadecimais", () => {
  it("nenhum arquivo em src/components ou src/app contém #RGB/#RRGGBB", () => {
    const offenders = roots
      .flatMap(files)
      .filter((f) => HEX.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
