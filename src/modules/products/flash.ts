import { routes } from "@/lib/routes";
import type { ProductErrorCode } from "./errors";
import type { RawParams } from "./list-params";

// Avisos mostrados após uma ação do admin. Vão na URL só como códigos de uma lista fechada;
// o texto nunca vem da URL (evita injeção de conteúdo).
export const NOTICE_MESSAGES = {
  published: "Produto publicado.",
  unpublished: "Produto tirado do ar (voltou para rascunho).",
  archived: "Produto arquivado.",
  reactivated: "Produto reativado como rascunho.",
  deleted: "Produto excluído.",
} as const;

export type NoticeKey = keyof typeof NOTICE_MESSAGES;

// Indexada por texto: novos códigos de erro não quebram a compilação; os sem mensagem usam a genérica.
export const ERROR_MESSAGES: Record<string, string> = {
  incomplete_product: "Ainda não dá para publicar: complete o cadastro do produto (opções de compra e foto).",
  invalid_transition: "Essa mudança de situação não é permitida agora. Recarregue a página e tente de novo.",
  not_found: "Produto não encontrado. Ele pode ter sido excluído.",
  forbidden: "Você não tem permissão para fazer isso.",
  validation: "Dados inválidos. Revise e tente de novo.",
  slug_taken: "Já existe um produto com esse endereço.",
  limit_exceeded: "Limite excedido.",
  image_limit: "Limite de fotos excedido.",
  invalid_file: "Arquivo inválido.",
  unexpected: "Não foi possível concluir. Tente novamente.",
};

export type Flash = { kind: "notice" | "error"; message: string } | null;

/** Lê o aviso ou erro da URL, aceitando apenas códigos conhecidos. */
export function readFlash(raw: RawParams): Flash {
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  const notice = pick(raw.aviso);
  if (notice && Object.hasOwn(NOTICE_MESSAGES, notice)) {
    return { kind: "notice", message: NOTICE_MESSAGES[notice as NoticeKey] };
  }
  const error = pick(raw.erro);
  if (error && Object.hasOwn(ERROR_MESSAGES, error)) {
    return { kind: "error", message: ERROR_MESSAGES[error as ProductErrorCode] };
  }
  return null;
}

/**
 * Aceita somente caminhos internos da lista de produtos (evita redirecionamento para
 * fora do site). Qualquer outra coisa volta para a lista.
 */
export function safeReturnTo(value: unknown): string {
  const fallback = routes.adminProducts();
  if (typeof value !== "string" || !value.startsWith(fallback)) return fallback;
  const rest = value.slice(fallback.length);
  if (rest !== "" && !rest.startsWith("?")) return fallback;
  if (value.includes("\\") || value.includes("//") || /[\r\n]/.test(value)) return fallback;
  return value;
}

/** Acrescenta o aviso ou erro à URL de retorno, trocando qualquer aviso anterior. */
export function withFlash(returnTo: string, flash: { aviso: NoticeKey } | { erro: ProductErrorCode }): string {
  const url = new URL(safeReturnTo(returnTo), "http://local.invalid");
  url.searchParams.delete("aviso");
  url.searchParams.delete("erro");
  if ("aviso" in flash) url.searchParams.set("aviso", flash.aviso);
  else url.searchParams.set("erro", flash.erro);
  return `${url.pathname}${url.search}`;
}
