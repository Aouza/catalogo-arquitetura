import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatPrice } from "@/lib/format";
import { whatsappMessageLink } from "@/lib/whatsapp";
import {
  buildWhatsAppMessage,
  ctaState,
  galleryFor,
  parseSelection,
  priceView,
} from "@/modules/catalogs/product-detail";
import { getProductPage } from "@/modules/catalogs/queries/get-product-page";
import { fetchProductDetail } from "@/modules/catalogs/queries/product-detail-data";
import { removeProductFiles } from "@/modules/media/cleanup-files";
import { anonClient, createAdmin, deleteUser, serviceClient, type TestUser } from "./helpers";

let admin: TestUser;
const createdProducts: string[] = [];
const previousEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};
const db = () => serviceClient();

type Seeded = {
  id: string;
  slug: string;
  colorId: Record<string, string>;
  imagePaths: Record<string, string>;
};

/**
 * Vestido do dia a dia: cor (rosa, azul) x tamanho (2, 4). Rosa·2 e rosa·4 disponíveis (rosa·4 com
 * preço próprio), azul·2 esgotado, azul·4 não existe. Fotos: geral, rosa e azul.
 */
async function seedDress(status: "draft" | "published" | "archived" = "published"): Promise<Seeded> {
  const slug = `vestido-${randomUUID().slice(0, 8)}`;
  const { data: product, error } = await db()
    .from("products")
    .insert({ slug, name: "Vestido Floral", description: "Algodão macio.", base_price_cents: 7990 })
    .select()
    .single();
  if (error) throw new Error(error.message);
  createdProducts.push(product.id);

  const option = async (code: string, name: string, position: number) =>
    (await db().from("product_options").insert({ product_id: product.id, code, name, position }).select().single()).data!;
  const value = async (optionId: string, code: string, label: string, position: number) =>
    (
      await db()
        .from("product_option_values")
        .insert({ option_id: optionId, product_id: product.id, code, label, position })
        .select()
        .single()
    ).data!;

  const color = await option("cor", "Cor", 0);
  const size = await option("tamanho", "Tamanho", 1);
  const rosa = await value(color.id, "rosa", "Rosa", 0);
  const azul = await value(color.id, "azul", "Azul", 1);
  const s2 = await value(size.id, "2", "2", 0);
  const s4 = await value(size.id, "4", "4", 1);

  const variant = async (values: string[], extra: Record<string, unknown>) => {
    const { data } = await db().from("product_variants").insert({ product_id: product.id, ...extra }).select().single();
    for (const valueId of values) {
      await db().from("variant_option_values").insert({ variant_id: data!.id, option_value_id: valueId });
    }
  };
  await variant([rosa.id, s2.id], {});
  await variant([rosa.id, s4.id], { price_override_cents: 8990 });
  await variant([azul.id, s2.id], { is_available: false });

  const imagePaths: Record<string, string> = {};
  const image = async (key: string, optionValueId: string | null) => {
    const path = `${product.id}/${randomUUID()}.png`;
    imagePaths[key] = path;
    await db().from("product_images").insert({
      product_id: product.id,
      option_value_id: optionValueId,
      storage_path: path,
      alt_text: key,
    });
  };
  await image("geral", null);
  await image("rosa", rosa.id);
  await image("azul", azul.id);

  if (status !== "draft") {
    const { error: statusError } = await db().from("products").update({ status }).eq("id", product.id);
    if (statusError) throw new Error(statusError.message);
  }
  return { id: product.id, slug, colorId: { rosa: rosa.id, azul: azul.id }, imagePaths };
}

beforeAll(async () => {
  admin = await createAdmin();
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
});

afterAll(async () => {
  if (previousEnv.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previousEnv.url;
  if (previousEnv.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousEnv.key;

  for (const id of createdProducts) await removeProductFiles(db(), id);
  if (createdProducts.length) await db().from("products").delete().in("id", createdProducts);
  await deleteUser(admin);
});

describe("fetchProductDetail", () => {
  it("devolve opções, combinações com preço efetivo e fotos de um produto publicado", async () => {
    const seeded = await seedDress();
    const detail = await fetchProductDetail(anonClient(), seeded.slug);
    if (!detail) throw new Error("produto não encontrado");

    expect(detail).toMatchObject({ slug: seeded.slug, name: "Vestido Floral", basePriceCents: 7990 });
    expect(detail.options.map((o) => [o.code, o.values.map((v) => v.code)])).toEqual([
      ["cor", ["rosa", "azul"]],
      ["tamanho", ["2", "4"]],
    ]);

    const byKey = Object.fromEntries(detail.variants.map((v) => [`${v.values.cor}·${v.values.tamanho}`, v]));
    expect(Object.keys(byKey).sort()).toEqual(["azul·2", "rosa·2", "rosa·4"]);
    expect(byKey["rosa·2"]).toMatchObject({ priceCents: 7990, isAvailable: true });
    expect(byKey["rosa·4"]).toMatchObject({ priceCents: 8990, isAvailable: true });
    expect(byKey["azul·2"]).toMatchObject({ isAvailable: false });

    expect(detail.images.map((i) => i.alt)).toEqual(["geral", "rosa", "azul"]);
    expect(detail.images[0].path).toBe(`/fotos/${seeded.imagePaths.geral}`);
  });

  it("rascunho, arquivado, inexistente e endereço inválido respondem como não encontrado", async () => {
    const draft = await seedDress("draft");
    const archived = await seedDress("archived");
    for (const slug of [draft.slug, archived.slug, `nao-existe-${randomUUID().slice(0, 6)}`, "Inválido Slug", "", "a".repeat(200)]) {
      expect(await fetchProductDetail(anonClient(), slug)).toBeNull();
    }
  });

  it("ao tirar o produto do ar, o link compartilhado passa a responder 404", async () => {
    const seeded = await seedDress();
    expect(await fetchProductDetail(anonClient(), seeded.slug)).not.toBeNull();
    await db().from("products").update({ status: "draft" }).eq("id", seeded.id);
    expect(await fetchProductDetail(anonClient(), seeded.slug)).toBeNull();
  });

  it("produto simples: uma variante padrão sem opções", async () => {
    const slug = `simples-${randomUUID().slice(0, 8)}`;
    const { data: product } = await db()
      .from("products")
      .insert({ slug, name: "Jaqueta Única", base_price_cents: 5000 })
      .select()
      .single();
    createdProducts.push(product!.id);
    await db().from("product_variants").insert({ product_id: product!.id, price_override_cents: 0 });
    await db().from("product_images").insert({ product_id: product!.id, storage_path: `${product!.id}/${randomUUID()}.png` });
    await db().from("products").update({ status: "published" }).eq("id", product!.id);

    const detail = await fetchProductDetail(anonClient(), slug);
    expect(detail?.options).toEqual([]);
    expect(detail?.variants).toEqual([expect.objectContaining({ values: {}, priceCents: 0, isAvailable: true })]);
  });
});

describe("getProductPage", () => {
  it("monta a página com loja, tema, categorias e o produto", async () => {
    const seeded = await seedDress();
    const result = await getProductPage(seeded.slug);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.view.store.name).toBeTruthy();
      expect(result.view.detail.slug).toBe(seeded.slug);
      expect(result.view.theme.colors.action).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("produto que não está publicado é not-found", async () => {
    const draft = await seedDress("draft");
    expect(await getProductPage(draft.slug)).toEqual({ status: "not-found" });
  });
});

describe("jornada do cliente com dados reais", () => {
  const journey = async () => {
    const seeded = await seedDress();
    const detail = (await fetchProductDetail(anonClient(), seeded.slug))!;
    return { seeded, detail };
  };

  it("abre sem escolha: pede cor e tamanho, mostra fotos gerais e preço de partida", async () => {
    const { detail } = await journey();
    const selection = parseSelection(detail, {});
    expect(ctaState(detail, selection)).toEqual({ kind: "choose", missing: ["Cor", "Tamanho"] });
    expect(galleryFor(detail, selection).map((i) => i.alt)).toEqual(["geral"]);
    expect(priceView(detail, selection)).toEqual({ cents: 7990, from: true });
  });

  it("escolhe a cor: a galeria troca para as fotos dela e depois as gerais", async () => {
    const { detail } = await journey();
    expect(galleryFor(detail, parseSelection(detail, { cor: "rosa" })).map((i) => i.alt)).toEqual(["rosa", "geral"]);
    expect(galleryFor(detail, parseSelection(detail, { cor: "azul" })).map((i) => i.alt)).toEqual(["azul", "geral"]);
    // Trocar o tamanho não altera a galeria.
    expect(galleryFor(detail, parseSelection(detail, { cor: "rosa", tamanho: "4" })).map((i) => i.alt)).toEqual([
      "rosa",
      "geral",
    ]);
  });

  it("escolhe cor e tamanho disponíveis: libera o WhatsApp com a mensagem da combinação e o preço dela", async () => {
    const { seeded, detail } = await journey();
    const selection = parseSelection(detail, { cor: "rosa", tamanho: "4" });
    const state = ctaState(detail, selection);
    if (state.kind !== "ready") throw new Error(`esperava ready, veio ${state.kind}`);

    const url = `https://loja.example/produto/${seeded.slug}?cor=rosa&tamanho=4`;
    const message = buildWhatsAppMessage({ detail, selection, variant: state.variant, url });
    expect(message).toBe(
      [
        "Olá! Tenho interesse neste produto:",
        "",
        "*Vestido Floral*",
        "Cor: Rosa",
        "Tamanho: 4",
        `Preço: ${formatPrice(8990)}`,
        "",
        url,
      ].join("\n"),
    );

    const link = whatsappMessageLink("+5511999990000", message)!;
    expect(new URL(link).searchParams.get("text")).toBe(message);
  });

  it("combinação esgotada não libera o botão", async () => {
    const { detail } = await journey();
    expect(ctaState(detail, parseSelection(detail, { cor: "azul", tamanho: "2" }))).toEqual({
      kind: "unavailable",
      reason: "combination",
    });
  });

  it("combinação que não existe na URL é descartada: azul·4 vira só 'azul'", async () => {
    const { detail } = await journey();
    expect(parseSelection(detail, { cor: "azul", tamanho: "4" })).toEqual({ cor: "azul" });
    expect(ctaState(detail, parseSelection(detail, { cor: "azul", tamanho: "4" }))).toMatchObject({
      kind: "choose",
      missing: ["Tamanho"],
    });
  });

  it("produto todo esgotado: indisponível, e continua publicado", async () => {
    const { seeded } = await journey();
    await db().from("product_variants").update({ is_available: false }).eq("product_id", seeded.id);
    const detail = (await fetchProductDetail(anonClient(), seeded.slug))!;
    expect(ctaState(detail, {})).toEqual({ kind: "unavailable", reason: "product" });
  });
});
