import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STOREFRONT_TAG } from "@/modules/catalogs/cache";

// As ações do painel dependem do Next (cookies, redirecionamento); aqui o que importa é o contrato:
// toda ação que pode mudar o que o público vê invalida a vitrine, e só depois de confirmar o admin.
const requireAdmin = vi.fn(async () => ({}));
const handlers = vi.hoisted(() => ({
  handleStatusChange: vi.fn(async () => "/admin/produtos?aviso=published"),
  handleDelete: vi.fn(async () => "/admin/produtos?aviso=deleted"),
  handleUpdateImage: vi.fn(async () => "/admin/produtos/x/fotos?aviso=photoUpdated"),
  handleDeleteImage: vi.fn(async () => "/admin/produtos/x/fotos?aviso=photoDeleted"),
  handleMoveImage: vi.fn(async () => "/admin/produtos/x/fotos?aviso=photosReordered"),
  handleToggleAvailability: vi.fn(async () => "/admin/produtos/x/publicar?aviso=availabilitySaved"),
  handleRegisterImage: vi.fn(async () => ({ ok: true as const })),
  handleCreateProduct: vi.fn(async () => ({ redirectTo: "/admin/produtos/x/opcoes?novo=1" })),
  handleUpdateProduct: vi.fn(async () => ({ state: { saved: true } })),
  handleSaveStructure: vi.fn(async () => ({ state: { saved: true } })),
}));

vi.mock("@/modules/auth/require-admin", () => ({ requireAdmin: () => requireAdmin() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/modules/products/admin-form-actions", () => ({
  handleStatusChange: handlers.handleStatusChange,
  handleDelete: handlers.handleDelete,
}));
vi.mock("@/modules/products/admin-photo-forms", () => ({
  handleUpdateImage: handlers.handleUpdateImage,
  handleDeleteImage: handlers.handleDeleteImage,
  handleMoveImage: handlers.handleMoveImage,
  handleToggleAvailability: handlers.handleToggleAvailability,
  handleRegisterImage: handlers.handleRegisterImage,
}));
vi.mock("@/modules/products/admin-product-forms", () => ({
  handleCreateProduct: handlers.handleCreateProduct,
  handleUpdateProduct: handlers.handleUpdateProduct,
  handleSaveStructure: handlers.handleSaveStructure,
}));

const actions = await import("@/app/admin/produtos/actions");
const form = new FormData();
const initial = {};

/** Ações que terminam em redirecionamento (o `redirect` do Next lança uma exceção especial). */
const redirecting: [string, () => Promise<unknown>][] = [
  ["publicar, tirar do ar, arquivar e reativar", () => actions.changeStatusAction(form)],
  ["excluir produto", () => actions.deleteProductAction(form)],
  ["alterar foto", () => actions.updateImageAction(form)],
  ["excluir foto", () => actions.deleteImageAction(form)],
  ["mover foto", () => actions.moveImageAction(form)],
  ["disponibilidade", () => actions.toggleAvailabilityAction(form)],
  ["criar produto", () => actions.createProductAction(initial, form)],
];

/** Ações que devolvem um resultado ao formulário. */
const returning: [string, () => Promise<unknown>][] = [
  ["editar dados", () => actions.updateProductAction(initial, form)],
  ["salvar cores e tamanhos", () => actions.saveStructureAction(initial, form)],
  [
    "registrar foto enviada",
    () => actions.registerImageAction({ productId: "p", path: "p/f.png", altText: "", optionValueId: null }),
  ],
];

beforeEach(() => {
  vi.mocked(updateTag).mockClear();
  requireAdmin.mockClear();
  requireAdmin.mockImplementation(async () => ({}));
  for (const handler of Object.values(handlers)) handler.mockClear();
});

describe("toda mudança do painel invalida a vitrine", () => {
  it.each(redirecting)("%s: invalida e redireciona", async (_name, run) => {
    await expect(run()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(updateTag).toHaveBeenCalledTimes(1);
    expect(updateTag).toHaveBeenCalledWith(STOREFRONT_TAG);
  });

  it.each(returning)("%s: invalida e devolve o resultado", async (_name, run) => {
    const result = await run();
    expect(result).toBeTruthy();
    expect(updateTag).toHaveBeenCalledTimes(1);
    expect(updateTag).toHaveBeenCalledWith(STOREFRONT_TAG);
  });

  it("cobre todas as ações exportadas (uma nova ação sem invalidação quebra este teste)", () => {
    const covered = redirecting.length + returning.length;
    expect(Object.keys(actions)).toHaveLength(covered);
  });
});

describe("a autorização vem antes de qualquer coisa", () => {
  it.each([...redirecting, ...returning])("%s: sem ser admin, não age nem invalida", async (_name, run) => {
    requireAdmin.mockImplementation(async () => {
      throw new Error("NEXT_REDIRECT /login");
    });

    await expect(run()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(updateTag).not.toHaveBeenCalled();
    for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled();
  });
});

describe("o redirecionamento continua levando para onde a ação mandou", () => {
  it("publicar volta para a tela indicada", async () => {
    await expect(actions.changeStatusAction(form)).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/produtos?aviso=published"),
    });
  });
});
