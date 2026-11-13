import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { removeProductFiles } from "@/modules/media/cleanup-files";
import { listProductImages } from "@/modules/media/list-product-images";
import {
  handleDeleteImage,
  handleMoveImage,
  handleRegisterImage,
  handleToggleAvailability,
  handleUpdateImage,
} from "@/modules/products/admin-photo-forms";
import { setProductStatus } from "@/modules/products/set-status";
import {
  addImage,
  anonClient,
  createAdmin,
  createUser,
  deleteUser,
  serviceClient,
  type TestUser,
} from "./helpers";

const BUCKET = "product-images";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

let admin: TestUser;
let plainUser: TestUser;
const createdProducts: string[] = [];

const db = () => serviceClient();
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

async function newProduct() {
  const { data, error } = await db()
    .from("products")
    .insert({ slug: `p-${randomUUID().slice(0, 8)}`, name: "Vestido", base_price_cents: 7990 })
    .select()
    .single();
  if (error) throw new Error(error.message);
  createdProducts.push(data.id);
  return data.id as string;
}

/** Simula o navegador: o admin envia o arquivo direto ao Storage, sem passar pelo servidor. */
async function browserUpload(productId: string, body: Buffer = PNG, extension = "png", contentType = "image/png") {
  const path = `${productId}/${randomUUID()}.${extension}`;
  const { error } = await admin.client.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(`upload falhou: ${error.message}`);
  return path;
}

const filesOf = async (productId: string) => {
  const { data } = await db().storage.from(BUCKET).list(productId);
  return (data ?? []).filter((file) => file.id !== null).map((file) => `${productId}/${file.name}`);
};
const rowsOf = async (productId: string) => {
  const { data } = await db()
    .from("product_images")
    .select("id, storage_path, alt_text, option_value_id")
    .eq("product_id", productId)
    .order("position");
  return data ?? [];
};

const url = (outcome: string) => new URL(outcome, "http://x");
const back = (id: string) => `/admin/produtos/${id}/fotos`;

beforeAll(async () => {
  admin = await createAdmin();
  plainUser = await createUser();
});

afterAll(async () => {
  for (const id of createdProducts) await removeProductFiles(db(), id);
  if (createdProducts.length) await db().from("products").delete().in("id", createdProducts);
  await deleteUser(admin);
  await deleteUser(plainUser);
});

describe("registrar foto enviada direto do navegador", () => {
  it("registra a foto, que passa a aparecer com URL temporária", async () => {
    const productId = await newProduct();
    const path = await browserUpload(productId);

    expect(await handleRegisterImage(admin.client, { productId, path, altText: "  Frente " })).toEqual({ ok: true });
    expect(await rowsOf(productId)).toEqual([expect.objectContaining({ storage_path: path, alt_text: "Frente" })]);

    const listed = await listProductImages(admin.client, productId);
    expect(listed.ok && listed.data[0].url).toMatch(/^http/);
  });

  it("liga a foto a uma cor do próprio produto", async () => {
    const productId = await newProduct();
    const { data: option } = await db()
      .from("product_options")
      .insert({ product_id: productId, name: "Cor", code: "cor" })
      .select()
      .single();
    const { data: value } = await db()
      .from("product_option_values")
      .insert({ option_id: option!.id, product_id: productId, label: "Rosa", code: "rosa" })
      .select()
      .single();

    const path = await browserUpload(productId);
    expect(await handleRegisterImage(admin.client, { productId, path, optionValueId: value!.id })).toEqual({ ok: true });
    expect((await rowsOf(productId))[0].option_value_id).toBe(value!.id);
  });

  it("recusa arquivo que não é imagem, mesmo enviado como PNG, e remove o arquivo", async () => {
    const productId = await newProduct();
    const path = await browserUpload(productId, Buffer.from("isto é um texto, não uma imagem"));

    const outcome = await handleRegisterImage(admin.client, { productId, path });
    expect(outcome).toMatchObject({ ok: false });
    expect(await rowsOf(productId)).toHaveLength(0);
    expect(await filesOf(productId)).toHaveLength(0);
  });

  it("recusa imagem com extensão diferente do conteúdo e remove o arquivo", async () => {
    const productId = await newProduct();
    const path = await browserUpload(productId, PNG, "jpg", "image/jpeg");

    expect(await handleRegisterImage(admin.client, { productId, path })).toMatchObject({ ok: false });
    expect(await filesOf(productId)).toHaveLength(0);
  });

  it("recusa caminho fora da pasta do produto ou com nome não gerado pelo sistema", async () => {
    const productId = await newProduct();
    const otherId = await newProduct();
    const foreignPath = await browserUpload(otherId);

    for (const path of [foreignPath, `${productId}/foto.png`, "foto.png", `${productId}/${randomUUID()}.gif`]) {
      expect(await handleRegisterImage(admin.client, { productId, path })).toMatchObject({ ok: false });
    }
    expect(await rowsOf(productId)).toHaveLength(0);
    expect(await rowsOf(otherId)).toHaveLength(0);
    // O arquivo do outro produto não é apagado por um pedido que apontou para ele.
    expect(await filesOf(otherId)).toEqual([foreignPath]);
  });

  it("arquivo que não existe no Storage", async () => {
    const productId = await newProduct();
    const outcome = await handleRegisterImage(admin.client, { productId, path: `${productId}/${randomUUID()}.png` });
    expect(outcome).toMatchObject({ ok: false, message: expect.stringContaining("Não encontramos") });
  });

  it("a 11ª foto é recusada e o arquivo removido", async () => {
    const productId = await newProduct();
    for (let i = 0; i < 10; i++) await addImage(productId);

    const path = await browserUpload(productId);
    const outcome = await handleRegisterImage(admin.client, { productId, path });
    expect(outcome).toMatchObject({ ok: false, message: "Limite de 10 fotos por produto." });
    expect(await filesOf(productId)).toHaveLength(0);
  });

  it("registrar duas vezes o mesmo arquivo não apaga a foto já cadastrada", async () => {
    const productId = await newProduct();
    const path = await browserUpload(productId);
    expect(await handleRegisterImage(admin.client, { productId, path })).toEqual({ ok: true });

    const again = await handleRegisterImage(admin.client, { productId, path });
    expect(again).toMatchObject({ ok: false, message: "Esta foto já foi cadastrada." });
    expect(await rowsOf(productId)).toHaveLength(1);
    expect(await filesOf(productId)).toEqual([path]);
  });

  it("pedido malformado", async () => {
    expect(await handleRegisterImage(admin.client, null)).toMatchObject({ ok: false });
    expect(await handleRegisterImage(admin.client, { productId: 1, path: 2 })).toMatchObject({ ok: false });
    expect(await handleRegisterImage(admin.client, { productId: "x", path: "y" })).toMatchObject({ ok: false });
  });

  it("anônimo e usuário comum não registram nem enviam", async () => {
    const productId = await newProduct();
    const path = await browserUpload(productId);

    for (const client of [anonClient(), plainUser.client]) {
      expect(await handleRegisterImage(client, { productId, path })).toMatchObject({ ok: false });
      const upload = await client.storage.from(BUCKET).upload(`${productId}/${randomUUID()}.png`, PNG, {
        contentType: "image/png",
      });
      expect(upload.error).not.toBeNull();
    }
    expect(await rowsOf(productId)).toHaveLength(0);
  });
});

describe("editar, ordenar e excluir fotos", () => {
  async function productWithPhotos(count: number) {
    const productId = await newProduct();
    const ids: string[] = [];
    for (let i = 0; i < count; i++) ids.push((await addImage(productId)).id);
    return { productId, ids };
  }

  const orderOf = async (productId: string) => (await rowsOf(productId)).map((row) => row.id);

  it("atualiza descrição e cor e volta à mesma tela com aviso", async () => {
    const { productId, ids } = await productWithPhotos(1);
    const outcome = url(
      await handleUpdateImage(
        admin.client,
        form({ imageId: ids[0], altText: "Vestido de frente", optionValueId: "", returnTo: back(productId) }),
      ),
    );
    expect(outcome.pathname).toBe(back(productId));
    expect(outcome.searchParams.get("aviso")).toBe("photoUpdated");
    expect((await rowsOf(productId))[0].alt_text).toBe("Vestido de frente");
  });

  it("cor de outro produto é recusada", async () => {
    const { productId, ids } = await productWithPhotos(1);
    const otherId = await newProduct();
    const { data: option } = await db()
      .from("product_options")
      .insert({ product_id: otherId, name: "Cor", code: "cor" })
      .select()
      .single();
    const { data: foreign } = await db()
      .from("product_option_values")
      .insert({ option_id: option!.id, product_id: otherId, label: "Azul", code: "azul" })
      .select()
      .single();

    const outcome = url(
      await handleUpdateImage(
        admin.client,
        form({ imageId: ids[0], altText: "x", optionValueId: foreign!.id, returnTo: back(productId) }),
      ),
    );
    expect(outcome.searchParams.get("erro")).toBe("validation");
    expect((await rowsOf(productId))[0].option_value_id).toBeNull();
  });

  it("sobe e desce fotos; a primeira da ordem é a capa; nos limites nada muda", async () => {
    const { productId, ids } = await productWithPhotos(3);
    const move = async (imageId: string, direction: string) =>
      url(await handleMoveImage(admin.client, form({ productId, imageId, direction, returnTo: back(productId) })));

    expect((await move(ids[2], "up")).searchParams.get("aviso")).toBe("photosReordered");
    expect(await orderOf(productId)).toEqual([ids[0], ids[2], ids[1]]);

    await move(ids[2], "up");
    expect(await orderOf(productId)).toEqual([ids[2], ids[0], ids[1]]);

    const noop = await move(ids[2], "up");
    expect(noop.searchParams.has("aviso") || noop.searchParams.has("erro")).toBe(false);
    expect(await orderOf(productId)).toEqual([ids[2], ids[0], ids[1]]);

    await move(ids[2], "down");
    expect(await orderOf(productId)).toEqual([ids[0], ids[2], ids[1]]);
  });

  it("mover foto de outro produto ou com dados inválidos é recusado", async () => {
    const a = await productWithPhotos(2);
    const b = await productWithPhotos(2);

    const foreign = url(
      await handleMoveImage(
        admin.client,
        form({ productId: a.productId, imageId: b.ids[0], direction: "down", returnTo: back(a.productId) }),
      ),
    );
    expect(foreign.searchParams.get("erro")).toBe("not_found");

    const invalid = url(
      await handleMoveImage(
        admin.client,
        form({ productId: a.productId, imageId: a.ids[0], direction: "sideways", returnTo: back(a.productId) }),
      ),
    );
    expect(invalid.searchParams.get("erro")).toBe("validation");
    expect(await orderOf(a.productId)).toEqual(a.ids);
    expect(await orderOf(b.productId)).toEqual(b.ids);
  });

  it("exclui a foto e o arquivo", async () => {
    const productId = await newProduct();
    const path = await browserUpload(productId);
    await handleRegisterImage(admin.client, { productId, path });
    const [row] = await rowsOf(productId);

    const outcome = url(await handleDeleteImage(admin.client, form({ imageId: row.id, returnTo: back(productId) })));
    expect(outcome.searchParams.get("aviso")).toBe("photoDeleted");
    expect(await rowsOf(productId)).toHaveLength(0);
    expect(await filesOf(productId)).toHaveLength(0);
  });

  it("a última foto de um produto publicado não pode ser excluída", async () => {
    const productId = await newProduct();
    await db().from("product_variants").insert({ product_id: productId });
    const photo = await addImage(productId);
    expect(await setProductStatus(admin.client, productId, "published")).toMatchObject({ ok: true });

    const outcome = url(await handleDeleteImage(admin.client, form({ imageId: photo.id, returnTo: back(productId) })));
    expect(outcome.searchParams.get("erro")).toBe("incomplete_product");
    expect(await rowsOf(productId)).toHaveLength(1);
  });

  it("anônimo e usuário comum não alteram, movem nem excluem", async () => {
    const { productId, ids } = await productWithPhotos(2);
    for (const client of [anonClient(), plainUser.client]) {
      const update = url(
        await handleUpdateImage(client, form({ imageId: ids[0], altText: "Invadida", optionValueId: "", returnTo: back(productId) })),
      );
      const move = url(
        await handleMoveImage(client, form({ productId, imageId: ids[1], direction: "up", returnTo: back(productId) })),
      );
      const del = url(await handleDeleteImage(client, form({ imageId: ids[0], returnTo: back(productId) })));
      for (const outcome of [update, move, del]) expect(outcome.searchParams.has("erro")).toBe(true);
    }
    expect(await orderOf(productId)).toEqual(ids);
    expect((await rowsOf(productId))[0].alt_text).toBe("");
  });

  it("retorno malicioso é trocado pela lista", async () => {
    const { ids } = await productWithPhotos(1);
    const outcome = await handleDeleteImage(admin.client, form({ imageId: ids[0], returnTo: "https://evil.example" }));
    expect(outcome.startsWith("/admin/produtos?")).toBe(true);
  });
});

describe("disponibilidade de produto no ar", () => {
  async function publishedProduct() {
    const productId = await newProduct();
    const { data: variants } = await db()
      .from("product_variants")
      .insert([{ product_id: productId }])
      .select("id");
    await addImage(productId);
    expect(await setProductStatus(admin.client, productId, "published")).toMatchObject({ ok: true });
    return { productId, variantId: variants![0].id as string };
  }

  const availability = async (variantId: string) => {
    const { data } = await db().from("product_variants").select("is_available").eq("id", variantId).single();
    return data!.is_available as boolean;
  };

  it("marca como indisponível e volta a disponível, sem tirar o produto do ar", async () => {
    const { productId, variantId } = await publishedProduct();
    const returnTo = `/admin/produtos/${productId}/publicar`;

    const off = url(await handleToggleAvailability(admin.client, form({ variantId, available: "false", returnTo })));
    expect(off.pathname).toBe(returnTo);
    expect(off.searchParams.get("aviso")).toBe("availabilitySaved");
    expect(await availability(variantId)).toBe(false);

    await handleToggleAvailability(admin.client, form({ variantId, available: "true", returnTo }));
    expect(await availability(variantId)).toBe(true);

    const { data } = await db().from("products").select("status").eq("id", productId).single();
    expect(data!.status).toBe("published");
  });

  it("dados inválidos e combinação inexistente", async () => {
    const returnTo = "/admin/produtos";
    expect(url(await handleToggleAvailability(admin.client, form({ variantId: "x", available: "true", returnTo }))).searchParams.get("erro")).toBe("validation");
    const { variantId } = await publishedProduct();
    expect(url(await handleToggleAvailability(admin.client, form({ variantId, available: "talvez", returnTo }))).searchParams.get("erro")).toBe("validation");
    expect(url(await handleToggleAvailability(admin.client, form({ variantId: randomUUID(), available: "true", returnTo }))).searchParams.get("erro")).toBe("not_found");
  });

  it("anônimo e usuário comum não alteram a disponibilidade", async () => {
    const { productId, variantId } = await publishedProduct();
    const returnTo = `/admin/produtos/${productId}/publicar`;
    for (const client of [anonClient(), plainUser.client]) {
      await handleToggleAvailability(client, form({ variantId, available: "false", returnTo }));
    }
    expect(await availability(variantId)).toBe(true);
  });
});
