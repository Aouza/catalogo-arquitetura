// Erros e avisos do cadastro de categorias. Mensagens em pt-BR, sem detalhe interno.

export type CategoryErrorCode =
  | "invalid_name"
  | "category_exists"
  | "category_not_found"
  | "forbidden"
  | "unexpected";

export type CategoryError = { code: CategoryErrorCode; message: string };

export type CategoryResult<T> = { ok: true; data: T } | { ok: false; error: CategoryError };

export const categoryOk = <T>(data: T): CategoryResult<T> => ({ ok: true, data });
export const categoryFail = (error: CategoryError): CategoryResult<never> => ({ ok: false, error });

export const CATEGORY_ERROR_MESSAGES: Record<CategoryErrorCode, string> = {
  invalid_name: "Informe um nome de até 80 caracteres, com letras ou números.",
  category_exists: "Já existe uma categoria com esse nome.",
  category_not_found: "Categoria não encontrada. Ela pode ter sido excluída.",
  forbidden: "Você não tem permissão para fazer isso.",
  unexpected: "Não foi possível concluir. Tente novamente.",
};

export const CATEGORY_NOTICE_MESSAGES = {
  created: "Categoria criada.",
  renamed: "Nome atualizado.",
  moved: "Ordem atualizada.",
  deleted: "Categoria excluída. Os produtos dela ficaram sem categoria.",
} as const;

export type CategoryNoticeKey = keyof typeof CATEGORY_NOTICE_MESSAGES;

type DbError = { code?: string | null; message?: string | null; details?: string | null };

/** Traduz um erro do Supabase em um erro de domínio. Nunca repassa a mensagem crua. */
export function mapCategoryDbError(error: DbError): CategoryError {
  const code = error.code ?? "";
  const key: CategoryErrorCode =
    code === "23505" ? "category_exists" : code === "42501" ? "forbidden" : "unexpected";
  return { code: key, message: CATEGORY_ERROR_MESSAGES[key] };
}

export const notFoundCategory = (): CategoryError => ({
  code: "category_not_found",
  message: CATEGORY_ERROR_MESSAGES.category_not_found,
});

export const invalidName = (): CategoryError => ({
  code: "invalid_name",
  message: CATEGORY_ERROR_MESSAGES.invalid_name,
});
