import { describe, expect, it } from "vitest";
import { moveImage } from "@/modules/media/photo-order";
import { isValidUploadPath } from "@/modules/media/register-uploaded-image";
import { readFlash, safeReturnTo, withFlash } from "@/modules/products/flash";
import { buildChecklist, isReadyToPublish } from "@/modules/products/publish-checklist";
import { variantLabel } from "@/modules/products/variant-labels";

const ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const FILE_ID = "9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";

describe("moveImage (ordem da galeria; a primeira é a capa)", () => {
  const order = ["a", "b", "c"];

  it("sobe e desce uma posição", () => {
    expect(moveImage(order, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveImage(order, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("subir a primeira ou descer a última não muda nada", () => {
    expect(moveImage(order, "a", "up")).toEqual(order);
    expect(moveImage(order, "c", "down")).toEqual(order);
  });

  it("subir uma foto até a primeira posição a torna a capa", () => {
    expect(moveImage(["a", "b", "c"], "c", "up")[1]).toBe("c");
    expect(moveImage(moveImage(["a", "b", "c"], "c", "up"), "c", "up")[0]).toBe("c");
  });

  it("id desconhecido não muda nada e a lista original não é alterada", () => {
    const original = [...order];
    expect(moveImage(order, "zzz", "up")).toEqual(order);
    moveImage(order, "b", "down");
    expect(order).toEqual(original);
  });
});

const option = (code: string, labels: string[]) => ({
  id: `o-${code}`,
  code,
  name: code,
  position: 0,
  values: labels.map((label, position) => ({ id: `v-${label}`, code: label.toLowerCase(), label, position })),
});
const variant = (values: Record<string, string>) => ({
  id: crypto.randomUUID(),
  values,
  priceOverrideCents: null,
  effectivePriceCents: 7990,
  isAvailable: true,
  position: 0,
});

describe("buildChecklist (o que falta para publicar)", () => {
  const dress = {
    id: ID,
    name: "Vestido",
    options: [option("cor", ["Rosa"]), option("tamanho", ["2"])],
    variants: [variant({ cor: "rosa", tamanho: "2" })],
  };

  it("tudo pronto: dados, combinações e ao menos uma foto", () => {
    const items = buildChecklist(dress, 1);
    expect(items.map((i) => [i.id, i.done])).toEqual([
      ["data", true],
      ["options", true],
      ["photos", true],
    ]);
    expect(isReadyToPublish(items)).toBe(true);
  });

  it("sem foto e sem combinação aparecem como pendentes, com link para o passo", () => {
    const items = buildChecklist({ ...dress, options: [], variants: [] }, 0);
    expect(items.find((i) => i.id === "options")).toMatchObject({
      done: false,
      href: `/admin/produtos/${ID}/opcoes`,
    });
    expect(items.find((i) => i.id === "photos")).toMatchObject({
      done: false,
      href: `/admin/produtos/${ID}/fotos`,
      pending: "Adicione ao menos uma foto.",
    });
    expect(isReadyToPublish(items)).toBe(false);
  });

  it("produto simples (sem opções) com a variante padrão está pronto", () => {
    const items = buildChecklist({ ...dress, options: [], variants: [variant({})] }, 2);
    expect(isReadyToPublish(items)).toBe(true);
  });

  it("opção sem valores ou variante incompleta deixam 'Cores e tamanhos' pendente", () => {
    expect(
      buildChecklist({ ...dress, options: [option("cor", [])], variants: [variant({})] }, 1).find(
        (i) => i.id === "options",
      )?.done,
    ).toBe(false);
    expect(
      buildChecklist({ ...dress, variants: [variant({ cor: "rosa" })] }, 1).find((i) => i.id === "options")?.done,
    ).toBe(false);
  });
});

describe("variantLabel", () => {
  const product = { options: [option("cor", ["Rosa", "Azul"]), option("tamanho", ["2", "4"])] };

  it("junta os nomes na ordem das opções", () => {
    expect(variantLabel(product, { values: { cor: "azul", tamanho: "4" } })).toBe("Azul · 4");
    expect(variantLabel(product, { values: { tamanho: "2", cor: "rosa" } })).toBe("Rosa · 2");
  });

  it("produto simples e valor desconhecido", () => {
    expect(variantLabel({ options: [] }, { values: {} })).toBe("Produto único");
    expect(variantLabel(product, { values: { cor: "verde" } })).toBe("Produto único");
  });
});

describe("safeReturnTo com as telas do cadastro", () => {
  it.each([
    "/admin/produtos",
    "/admin/produtos?q=a&pagina=2",
    `/admin/produtos/${ID}`,
    `/admin/produtos/${ID}/opcoes`,
    `/admin/produtos/${ID}/fotos`,
    `/admin/produtos/${ID}/publicar`,
    `/admin/produtos/${ID}/publicar?aviso=published`,
  ])("aceita %s", (path) => {
    expect(safeReturnTo(path)).toBe(path);
  });

  it.each([
    "/admin/produtos/nao-e-id/fotos",
    `/admin/produtos/${ID}/outra-tela`,
    `/admin/produtos/${ID}/fotos/extra`,
    `/admin/produtos/${ID}/..//evil`,
    `/admin/produtos/${ID}/fotos?x=\\evil`,
    "/admin/produtos/novo",
    "https://evil.example/admin/produtos",
  ])("rejeita %s e volta para a lista", (path) => {
    expect(safeReturnTo(path)).toBe("/admin/produtos");
  });

  it("withFlash mantém a tela de origem", () => {
    const url = withFlash(`/admin/produtos/${ID}/fotos`, { aviso: "photoDeleted" });
    expect(url).toBe(`/admin/produtos/${ID}/fotos?aviso=photoDeleted`);
  });
});

describe("avisos das fotos e da disponibilidade", () => {
  it.each([
    ["photoUpdated", "Foto atualizada."],
    ["photoDeleted", "Foto excluída."],
    ["photosReordered", "Ordem das fotos atualizada."],
    ["availabilitySaved", "Disponibilidade atualizada."],
  ])("%s", (key, message) => {
    expect(readFlash({ aviso: key })).toEqual({ kind: "notice", message });
  });

  it("produto incompleto explica o que é preciso, valendo para publicar e para excluir foto", () => {
    expect(readFlash({ erro: "incomplete_product" })?.message).toMatch(/opção de compra e uma foto/);
  });
});

describe("isValidUploadPath", () => {
  it.each([`${ID}/${FILE_ID}.png`, `${ID}/${FILE_ID}.jpg`, `${ID}/${FILE_ID}.WEBP`])("aceita %s", (path) => {
    expect(isValidUploadPath(ID, path)).toBe(true);
  });

  it.each([
    "foto.png",
    `${ID}/foto.png`,
    `${ID}/${FILE_ID}.gif`,
    `${ID}/${FILE_ID}.svg`,
    `${ID}/${FILE_ID}.png.exe`,
    `${ID}/sub/${FILE_ID}.png`,
    `../${ID}/${FILE_ID}.png`,
    `4f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b/${FILE_ID}.png`,
    `${ID}/${FILE_ID}.png/..`,
  ])("rejeita %s", (path) => {
    expect(isValidUploadPath(ID, path)).toBe(false);
  });
});
