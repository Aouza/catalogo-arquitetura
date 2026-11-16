import { createPublicClient } from "@/lib/supabase/public";
import { PRODUCT_IMAGES_BUCKET } from "@/modules/media/constants";
import { isValidUploadPath } from "@/modules/media/register-uploaded-image";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const notFound = () => new Response("Foto não encontrada", { status: 404 });

/**
 * Endereço público e estável das fotos de produtos publicados. A leitura usa o cliente anônimo,
 * então o banco só entrega o arquivo de uma foto cadastrada de produto publicado: rascunho,
 * arquivado e arquivo sem foto cadastrada respondem 404. O cache é curto para que uma foto
 * tirada do ar deixe de ser servida logo.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ productId: string; file: string }> },
) {
  const { productId, file } = await context.params;
  const path = `${productId}/${file}`;
  if (!isValidUploadPath(productId, path)) return notFound();

  const client = createPublicClient();
  if (!client) return notFound();

  const { data, error } = await client.storage.from(PRODUCT_IMAGES_BUCKET).download(path);
  if (error || !data) return notFound();

  const extension = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  return new Response(data, {
    headers: {
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
