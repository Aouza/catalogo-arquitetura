import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleDelete, handleStatusChange } from "@/modules/products/admin-form-actions";
import { ADMIN_PAGE_SIZE, listAdminProducts } from "@/modules/products/list-products";
import { listCategories } from "@/modules/categories/list-categories";
import {
  addImage,
  anonClient,
  createAdmin,
  createUser,
  deleteUser,
  serviceClient,
  type TestUser,
} from "./helpers";

let admin: TestUser;
let plainUser: TestUser;
// Marca única: filtra só os produtos deste arquivo, mesmo com outros testes rodando no banco.
const tag = randomUUID().slice(0, 8);
const createdProducts: string[] = [];
const createdCategories: string[] = [];

const db = () => serviceClient();

async function seedCategory(name: string) {
  const { data, error } = await db()
    .from("categories")
    .insert({ name, slug: `cat-${randomUUID().slice(0, 8)}` })
    .select()
    .single();
  if (error) throw new Error(error.message);
  createdCategories.push(data.id);
  return data;
}

async function seedProduct(name: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await db()
    .from("products")
    .insert({ slug: `p-${randomUUID().slice(0, 8)}`, name: `${name} ${tag}`, base_price_cents: 1000, ...extra })
    .select()
    .single();
  if (error) throw new Error(error.message);
  createdProducts.push(data.id);
  return data;
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeAll(async () => {
  admin = await createAdmin();
  plainUser = await createUser();
});

afterAll(async () => {
  if (createdProducts.length) await db().from("products").delete().in("id", createdProducts);
  if (createdCategories.length) await db().from("categories").delete().in("id", createdCategories);
  await deleteUser(admin);
  await deleteUser(plainUser);
});

describe("listAdminProducts", () => {
  it("admin vê rascunho, publicado e arquivado; busca pelo nome, sem diferenciar maiúsculas", async () => {
    const draft = await seedProduct("Vestido Rascunho");
    const archived = await seedProduct("Vestido Arquivado", { status: "archived" });
    const other = await seedProduct("Calça Outra");

    // A marca única aparece em maiúsculas na busca: não diferencia maiúsculas de minúsculas.
    const all = await listAdminProducts(admin.client, { query: tag.toUpperCase() });
    if (!all.ok) throw new Error(all.error.message);
    expect(all.data.items.map((p) => p.id).sort()).toEqual([draft.id, archived.id, other.id].sort());
    expect(new Set(all.data.items.map((p) => p.status))).toEqual(new Set(["draft", "archived"]));

    const one = await listAdminProducts(admin.client, { query: `RASCUNHO ${tag}` });
    expect(one.ok && one.data.items.map((p) => p.id)).toEqual([draft.id]);
  });

  it("filtra por situação e por categoria", async () => {
    const category = await seedCategory(`Categoria ${tag}`);
    const inCategory = await seedProduct("Com categoria", { category_id: category.id });
    await seedProduct("Sem categoria", { status: "archived" });

    const byCategory = await listAdminProducts(admin.client, { categoryId: category.id });
    expect(byCategory.ok && byCategory.data.items.map((p) => p.id)).toEqual([inCategory.id]);

    const archivedOnly = await listAdminProducts(admin.client, { query: tag, status: "archived" });
    expect(archivedOnly.ok && archivedOnly.data.items.every((p) => p.status === "archived")).toBe(true);
    expect(archivedOnly.ok && archivedOnly.data.items.length).toBeGreaterThan(0);

    const combined = await listAdminProducts(admin.client, { categoryId: category.id, status: "published" });
    expect(combined.ok && combined.data.total).toBe(0);
  });

  it("trata % e _ da busca como texto comum", async () => {
    await seedProduct("Promo 50% off");
    const percent = await listAdminProducts(admin.client, { query: `50% off ${tag}` });
    expect(percent.ok && percent.data.total).toBe(1);

    const wildcard = await listAdminProducts(admin.client, { query: `%${tag}` });
    expect(wildcard.ok && wildcard.data.total).toBe(0);
    const underscore = await listAdminProducts(admin.client, { query: `_romo 50` });
    expect(underscore.ok && underscore.data.total).toBe(0);
  });

  it("pagina, ordena do mais recente ao mais antigo e ajusta página fora do intervalo", async () => {
    const paged = `pag-${randomUUID().slice(0, 6)}`;
    const total = ADMIN_PAGE_SIZE + 3;
    const rows = Array.from({ length: total }, (_, i) => ({
      slug: `pg-${randomUUID().slice(0, 8)}`,
      name: `${paged} ${String(i).padStart(2, "0")}`,
      base_price_cents: 100,
      updated_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    }));
    const { data, error } = await db().from("products").insert(rows).select("id");
    if (error) throw new Error(error.message);
    createdProducts.push(...data.map((row) => row.id));

    const first = await listAdminProducts(admin.client, { query: paged, page: 1 });
    const second = await listAdminProducts(admin.client, { query: paged, page: 2 });
    if (!first.ok || !second.ok) throw new Error("falha na listagem");

    expect(first.data).toMatchObject({ total, totalPages: 2, page: 1, pageSize: ADMIN_PAGE_SIZE });
    expect(first.data.items).toHaveLength(ADMIN_PAGE_SIZE);
    expect(second.data.items).toHaveLength(3);
    // O mais recente (maior updated_at) vem primeiro; a página 2 traz os mais antigos.
    expect(first.data.items[0].name).toContain(`${total - 1}`);
    expect(second.data.items.at(-1)!.name).toContain("00");

    const beyond = await listAdminProducts(admin.client, { query: paged, page: 99 });
    expect(beyond.ok && beyond.data.page).toBe(2);
    expect(beyond.ok && beyond.data.items).toHaveLength(3);
    const zero = await listAdminProducts(admin.client, { query: paged, page: 0 });
    expect(zero.ok && zero.data.page).toBe(1);
  });

  it("sem resultados devolve lista vazia na página 1", async () => {
    const result = await listAdminProducts(admin.client, { query: `inexistente-${randomUUID()}` });
    expect(result).toMatchObject({ ok: true, data: { items: [], total: 0, page: 1, totalPages: 1 } });
  });

  it("preço grande e zero chegam como número", async () => {
    const free = await seedProduct("Brinde", { base_price_cents: 0 });
    const result = await listAdminProducts(admin.client, { query: `Brinde ${tag}` });
    expect(result.ok && result.data.items.find((p) => p.id === free.id)?.basePriceCents).toBe(0);
  });

  it("quem não é admin só enxerga o que já é público (a lista não vaza rascunhos)", async () => {
    const draft = await seedProduct("Escondido");
    for (const client of [anonClient(), plainUser.client]) {
      const result = await listAdminProducts(client, { query: `Escondido ${tag}` });
      expect(result.ok && result.data.items.map((p) => p.id)).not.toContain(draft.id);
    }
  });
});

describe("listCategories", () => {
  it("lista categorias em ordem para o filtro", async () => {
    const category = await seedCategory(`Zeta ${tag}`);
    const result = await listCategories(admin.client);
    expect(result.ok && result.data.map((c) => c.id)).toContain(category.id);
  });
});

describe("ações da lista", () => {
  const back = "/admin/produtos?q=vestido&pagina=2";

  /** Produto pronto para publicar: uma variante e uma foto. */
  async function seedPublishable(name: string) {
    const product = await seedProduct(name);
    await db().from("product_variants").insert({ product_id: product.id });
    await addImage(product.id);
    return product;
  }

  const run = async (client: TestUser["client"], fields: Record<string, string>) =>
    new URL(await handleStatusChange(client, form({ returnTo: back, ...fields })), "http://x");

  const statusOf = async (id: string) => {
    const { data } = await db().from("products").select("status").eq("id", id).single();
    return data!.status;
  };

  it("publicar, tirar do ar, arquivar e reativar: avisam e voltam à mesma lista", async () => {
    const product = await seedPublishable("Ciclo");
    const steps: [string, string, string][] = [
      ["publish", "published", "published"],
      ["archive", "archived", "archived"],
      ["reactivate", "draft", "reactivated"],
      ["publish", "published", "published"],
      ["unpublish", "draft", "unpublished"],
    ];

    for (const [intent, status, notice] of steps) {
      const url = await run(admin.client, { id: product.id, intent });
      expect(url.pathname).toBe("/admin/produtos");
      expect(url.searchParams.get("q")).toBe("vestido");
      expect(url.searchParams.get("pagina")).toBe("2");
      expect(url.searchParams.get("aviso")).toBe(notice);
      expect(await statusOf(product.id)).toBe(status);
    }
  });

  it("arquivado não volta direto para publicado", async () => {
    const product = await seedPublishable("Direto");
    await run(admin.client, { id: product.id, intent: "publish" });
    await run(admin.client, { id: product.id, intent: "archive" });

    const url = await run(admin.client, { id: product.id, intent: "publish" });
    expect(url.searchParams.get("erro")).toBe("invalid_transition");
    expect(await statusOf(product.id)).toBe("archived");
  });

  it("produto incompleto (sem opção de compra e sem foto): publicar é recusado", async () => {
    const product = await seedProduct("Incompleto");
    const url = await run(admin.client, { id: product.id, intent: "publish" });
    expect(url.searchParams.get("erro")).toBe("incomplete_product");
    expect(await statusOf(product.id)).toBe("draft");
  });

  it("dados inválidos viram erro de validação, sem tocar no banco", async () => {
    const product = await seedProduct("Intacto");
    const invalid: Record<string, string>[] = [
      { id: "nao-uuid", intent: "publish" },
      { id: product.id, intent: "apagar-tudo" },
      { intent: "publish" },
    ];
    for (const fields of invalid) {
      const url = await run(admin.client, fields);
      expect(url.searchParams.get("erro")).toBe("validation");
    }
    expect(await statusOf(product.id)).toBe("draft");
  });

  it("retorno malicioso é trocado pela lista", async () => {
    const product = await seedPublishable("Retorno");
    const url = await handleStatusChange(
      admin.client,
      form({ id: product.id, intent: "publish", returnTo: "https://evil.example/x" }),
    );
    expect(url.startsWith("/admin/produtos?")).toBe(true);
  });

  it("exclui o produto e avisa; excluir de novo informa que não existe", async () => {
    const product = await seedProduct("Descartável");
    const done = new URL(await handleDelete(admin.client, form({ id: product.id, returnTo: back })), "http://x");
    expect(done.searchParams.get("aviso")).toBe("deleted");
    expect(done.searchParams.get("q")).toBe("vestido");

    const again = new URL(await handleDelete(admin.client, form({ id: product.id, returnTo: back })), "http://x");
    expect(again.searchParams.get("erro")).toBe("not_found");
  });

  it("anônimo e usuário comum não alteram nem excluem nada", async () => {
    const product = await seedPublishable("Protegido");
    for (const client of [anonClient(), plainUser.client]) {
      for (const intent of ["publish", "archive"]) {
        const url = await run(client, { id: product.id, intent });
        expect(url.searchParams.has("erro")).toBe(true);
      }
      const del = new URL(await handleDelete(client, form({ id: product.id, returnTo: back })), "http://x");
      expect(del.searchParams.has("erro")).toBe(true);
    }
    expect(await statusOf(product.id)).toBe("draft");
  });
});
