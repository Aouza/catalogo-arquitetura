import { routes } from "@/lib/routes";
import {
  CATEGORY_ERROR_MESSAGES,
  CATEGORY_NOTICE_MESSAGES,
  type CategoryErrorCode,
  type CategoryNoticeKey,
} from "./errors";

type RawParams = Record<string, string | string[] | undefined>;

export type CategoryFlash = { kind: "notice" | "error"; message: string } | null;

/** Lê o aviso ou erro da URL, aceitando apenas códigos conhecidos (o texto nunca vem da URL). */
export function readCategoryFlash(raw: RawParams): CategoryFlash {
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  const notice = pick(raw.aviso);
  if (notice && Object.hasOwn(CATEGORY_NOTICE_MESSAGES, notice)) {
    return { kind: "notice", message: CATEGORY_NOTICE_MESSAGES[notice as CategoryNoticeKey] };
  }
  const error = pick(raw.erro);
  if (error && Object.hasOwn(CATEGORY_ERROR_MESSAGES, error)) {
    return { kind: "error", message: CATEGORY_ERROR_MESSAGES[error as CategoryErrorCode] };
  }
  return null;
}

/** URL da lista de categorias com o aviso ou erro de uma ação. */
export function categoriesUrl(flash: { aviso: CategoryNoticeKey } | { erro: CategoryErrorCode }): string {
  const params = new URLSearchParams();
  if ("aviso" in flash) params.set("aviso", flash.aviso);
  else params.set("erro", flash.erro);
  return `${routes.adminCategories()}?${params.toString()}`;
}
