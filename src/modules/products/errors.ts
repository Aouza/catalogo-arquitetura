// Resultado e erros dos casos de uso. Mensagens em pt-BR para o admin, sem detalhe interno.

export type ProductErrorCode =
  | "validation"
  | "slug_taken"
  | "not_found"
  | "forbidden"
  | "incomplete_product"
  | "limit_exceeded"
  | "invalid_transition"
  | "image_limit"
  | "invalid_file"
  | "unexpected";

export type ProductError = {
  code: ProductErrorCode;
  message: string;
  /** Detalhes legíveis (campos inválidos ou pendências de publicação). */
  issues?: string[];
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: ProductError };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (error: ProductError): Result<never> => ({ ok: false, error });

export const PUBLICATION_ISSUE_MESSAGES: Record<string, string> = {
  no_variants: "Cadastre ao menos uma opção de compra.",
  option_without_values: "Toda opção precisa de ao menos um valor.",
  incomplete_variants: "Há combinações incompletas: cada uma precisa de um valor de cada opção.",
  no_images: "Adicione ao menos uma foto.",
};

/** Código técnico da pendência → mensagem para o admin. */
export function describePublicationIssue(code: string): string {
  return PUBLICATION_ISSUE_MESSAGES[code] ?? "O produto ainda não está pronto para publicação.";
}

type DbError = { code?: string | null; message?: string | null; details?: string | null };

/** Traduz um erro do Supabase/PostgREST em um erro de domínio. Nunca repassa a mensagem crua. */
export function mapDbError(error: DbError): ProductError {
  const code = error.code ?? "";
  const text = `${error.message ?? ""} ${error.details ?? ""}`;

  const published = /cannot be published: (.+)$/.exec(error.message ?? "");
  if (published) {
    const issues = published[1].split(",").map((issue) => describePublicationIssue(issue.trim()));
    return {
      code: "incomplete_product",
      message: "O produto não pode ficar publicado enquanto estiver incompleto.",
      issues,
    };
  }

  if (/more than (2 options|20 option values|100 variants)/.test(text)) {
    return {
      code: "limit_exceeded",
      message: "Limite excedido: no máximo 2 opções, 20 valores e 100 combinações por produto.",
    };
  }

  if (/more than 10 images/.test(text)) {
    return { code: "image_limit", message: "Limite de 10 fotos por produto." };
  }

  if (/invalid image list/.test(text)) {
    return { code: "validation", message: "A lista de fotos não corresponde às fotos do produto." };
  }

  if (code === "23505" && /slug/i.test(text)) {
    return {
      code: "slug_taken",
      message: "Já existe um produto com esse endereço. Escolha outro.",
    };
  }

  if (code === "23503") {
    return { code: "validation", message: "Categoria inválida." };
  }

  if (code === "42501") {
    return { code: "forbidden", message: "Você não tem permissão para fazer isso." };
  }

  if (code === "P0002") {
    return { code: "not_found", message: "Produto não encontrado." };
  }

  if (/invalid payload|duplicate variant/.test(text)) {
    return { code: "validation", message: "A estrutura de opções e combinações é inválida." };
  }

  return { code: "unexpected", message: "Não foi possível concluir. Tente novamente." };
}

export const notFound = (): ProductError => ({
  code: "not_found",
  message: "Produto não encontrado.",
});
