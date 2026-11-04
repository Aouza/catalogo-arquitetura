import { describe, expect, it } from "vitest";
import { parseLogin } from "@/modules/auth/login-schema";

function form(email: unknown, password: unknown) {
  const data = new FormData();
  if (email !== undefined) data.set("email", email as string);
  if (password !== undefined) data.set("password", password as string);
  return data;
}

describe("parseLogin", () => {
  it("aceita credenciais válidas e normaliza o e-mail", () => {
    expect(parseLogin(form("  Dono@Loja.COM ", "segredo"))).toEqual({
      email: "dono@loja.com",
      password: "segredo",
    });
  });

  it("não altera nem apara a senha", () => {
    expect(parseLogin(form("a@b.com", "  espaços  "))?.password).toBe("  espaços  ");
  });

  it.each([
    ["e-mail ausente", undefined, "x"],
    ["senha ausente", "a@b.com", undefined],
    ["e-mail inválido", "nao-e-email", "x"],
    ["e-mail vazio", "", "x"],
    ["senha vazia", "a@b.com", ""],
    ["senha enorme", "a@b.com", "x".repeat(129)],
    ["e-mail enorme", `${"a".repeat(250)}@b.com`, "x"],
  ])("rejeita %s", (_name, email, password) => {
    expect(parseLogin(form(email, password))).toBeNull();
  });

  it("rejeita arquivo no lugar de texto", () => {
    const data = new FormData();
    data.set("email", new File(["x"], "x.txt"));
    data.set("password", "x");
    expect(parseLogin(data)).toBeNull();
  });
});
