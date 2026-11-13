import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, ok, type Result } from "@/modules/products/errors";
import { ORPHAN_GRACE_MS, PRODUCT_IMAGES_BUCKET } from "./constants";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 1000;

const cleanupFailed = () =>
  fail({ code: "unexpected" as const, message: "Não foi possível limpar os arquivos agora." });

/**
 * Apaga todos os arquivos da pasta de um produto (usada após excluir o produto, BR-015).
 * Idempotente: sem arquivos, não faz nada.
 */
export async function removeProductFiles(
  client: SupabaseClient,
  productId: string,
): Promise<Result<{ removed: number }>> {
  const bucket = client.storage.from(PRODUCT_IMAGES_BUCKET);
  const { data, error } = await bucket.list(productId, { limit: PAGE });
  if (error) return cleanupFailed();

  const paths = (data ?? []).filter((file) => file.id !== null).map((file) => `${productId}/${file.name}`);
  if (paths.length === 0) return ok({ removed: 0 });

  const removal = await bucket.remove(paths);
  if (removal.error) return cleanupFailed();
  return ok({ removed: paths.length });
}

/**
 * Recolhe arquivos que não pertencem a nenhuma foto cadastrada (falhas entre banco e Storage).
 * Ignora arquivos recentes, que podem estar em envio. Idempotente.
 */
export async function cleanupOrphanFiles(
  client: SupabaseClient,
  options: { olderThanMs?: number; now?: Date } = {},
): Promise<Result<{ removed: number }>> {
  const olderThanMs = options.olderThanMs ?? ORPHAN_GRACE_MS;
  const cutoff = (options.now ?? new Date()).getTime() - olderThanMs;
  const bucket = client.storage.from(PRODUCT_IMAGES_BUCKET);

  const root = await bucket.list("", { limit: PAGE });
  if (root.error) return cleanupFailed();

  let removed = 0;
  // Pastas têm `id` nulo; só interessam as de produto (nome em formato de UUID).
  const folders = (root.data ?? []).filter((entry) => entry.id === null && UUID.test(entry.name));

  for (const folder of folders) {
    const files = await bucket.list(folder.name, { limit: PAGE });
    if (files.error) return cleanupFailed();

    const { data: rows, error } = await client
      .from("product_images")
      .select("storage_path")
      .eq("product_id", folder.name);
    if (error) return cleanupFailed();

    const registered = new Set((rows ?? []).map((row) => row.storage_path as string));
    const orphans = (files.data ?? [])
      .filter((file) => file.id !== null)
      .filter((file) => !registered.has(`${folder.name}/${file.name}`))
      .filter((file) => {
        const created = file.created_at ? new Date(file.created_at).getTime() : 0;
        return created <= cutoff;
      })
      .map((file) => `${folder.name}/${file.name}`);

    if (orphans.length === 0) continue;
    const removal = await bucket.remove(orphans);
    if (removal.error) return cleanupFailed();
    removed += orphans.length;
  }

  return ok({ removed });
}
