import type { ProductError } from "@/modules/products/errors";

type StorageErrorLike = { message?: string; statusCode?: string | number };

/** Traduz erros do Storage em mensagens para o admin, sem repassar o texto interno. */
export function mapStorageError(error: StorageErrorLike): ProductError {
  const text = error.message ?? "";
  const status = String(error.statusCode ?? "");

  if (status === "401" || status === "403" || /row-level security|unauthorized|permission/i.test(text)) {
    return { code: "forbidden", message: "Você não tem permissão para enviar fotos." };
  }
  if (status === "413" || /exceeded|too large|maximum allowed size/i.test(text)) {
    return { code: "invalid_file", message: "A foto deve ter no máximo 5 MB." };
  }
  if (/mime|not supported|invalid.*type/i.test(text)) {
    return { code: "invalid_file", message: "Formato não aceito. Envie JPG, PNG ou WebP." };
  }
  return { code: "unexpected", message: "Não foi possível enviar a foto. Tente novamente." };
}
