import { describe, expect, it } from "vitest";
import { detectImageType } from "@/modules/media/file-type";
import { galleryImages } from "@/modules/media/gallery";
import { mapStorageError } from "@/modules/media/storage-errors";
import { mapDbError } from "@/modules/products/errors";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

describe("detectImageType (pelo conteúdo, não pelo nome)", () => {
  it("reconhece JPEG, PNG e WebP", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP")))).toBe("image/webp");
  });

  it.each([
    ["texto", bytes(...ascii("Olá, isto não é imagem"))],
    ["GIF", bytes(...ascii("GIF89a"), 0, 0)],
    ["SVG", bytes(...ascii("<svg xmlns"))],
    ["PDF", bytes(...ascii("%PDF-1.7"))],
    ["RIFF que não é WebP (WAV)", bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE"))],
    ["vazio", bytes()],
    ["PNG truncado", bytes(0x89, 0x50, 0x4e)],
  ])("rejeita %s", (_label, head) => {
    expect(detectImageType(head)).toBeNull();
  });
});

const img = (id: string, optionValueId: string | null, position: number) => ({ id, optionValueId, position });
const IMAGES = [
  img("geral-2", null, 3),
  img("rosa-1", "rosa", 1),
  img("azul-1", "azul", 2),
  img("geral-1", null, 0),
  img("rosa-2", "rosa", 4),
];
const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe("galleryImages (BR-031, BR-032)", () => {
  it("cor escolhida: fotos da cor primeiro, depois as gerais, sem fotos de outra cor", () => {
    expect(ids(galleryImages(IMAGES, "rosa"))).toEqual(["rosa-1", "rosa-2", "geral-1", "geral-2"]);
    expect(ids(galleryImages(IMAGES, "azul"))).toEqual(["azul-1", "geral-1", "geral-2"]);
  });

  it("trocar de cor muda a galeria", () => {
    expect(galleryImages(IMAGES, "rosa")).not.toEqual(galleryImages(IMAGES, "azul"));
  });

  it("cor sem fotos próprias usa as gerais", () => {
    expect(ids(galleryImages(IMAGES, "verde"))).toEqual(["geral-1", "geral-2"]);
  });

  it("sem escolha: só as gerais", () => {
    expect(ids(galleryImages(IMAGES))).toEqual(["geral-1", "geral-2"]);
    expect(ids(galleryImages(IMAGES, null))).toEqual(["geral-1", "geral-2"]);
  });

  it("sem fotos gerais e sem escolha: todas, na ordem", () => {
    const onlyColors = IMAGES.filter((image) => image.optionValueId !== null);
    expect(ids(galleryImages(onlyColors))).toEqual(["rosa-1", "azul-1", "rosa-2"]);
  });

  it("cor sem fotos e produto sem fotos gerais: galeria vazia (nunca foto de outra cor)", () => {
    const onlyColors = IMAGES.filter((image) => image.optionValueId !== null);
    expect(galleryImages(onlyColors, "verde")).toEqual([]);
  });

  it("não altera a lista original", () => {
    const copy = [...IMAGES];
    galleryImages(IMAGES, "rosa");
    expect(IMAGES).toEqual(copy);
  });
});

describe("erros de foto", () => {
  it("limite de 10 fotos e lista de ordenação inválida", () => {
    expect(mapDbError({ code: "23514", message: "product cannot have more than 10 images" }).code).toBe(
      "image_limit",
    );
    expect(mapDbError({ code: "23514", message: "invalid image list" }).code).toBe("validation");
  });

  it("publicar sem foto explica o motivo", () => {
    const error = mapDbError({ code: "23514", message: "product cannot be published: no_images" });
    expect(error).toMatchObject({ code: "incomplete_product", issues: ["Adicione ao menos uma foto."] });
  });

  it("erros do Storage viram mensagens claras sem vazar detalhe", () => {
    expect(mapStorageError({ statusCode: "403", message: "new row violates row-level security" }).code).toBe(
      "forbidden",
    );
    expect(mapStorageError({ statusCode: "413", message: "The object exceeded the maximum allowed size" }).code).toBe(
      "invalid_file",
    );
    expect(mapStorageError({ message: "mime type text/plain is not supported" }).code).toBe("invalid_file");
    const unknown = mapStorageError({ message: "internal bucket path /var/secret exploded" });
    expect(unknown.code).toBe("unexpected");
    expect(JSON.stringify(unknown)).not.toContain("secret");
  });
});
