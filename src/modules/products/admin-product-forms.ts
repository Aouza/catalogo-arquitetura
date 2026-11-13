import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { parseBrlToCents } from "@/lib/format";
import { routes } from "@/lib/routes";
import { createProduct } from "./create-product";
import type { ProductError } from "./errors";
import { saveProductStructure } from "./save-structure";
import type { StructureInput } from "./schemas";
import { updateProduct } from "./update-product";

// Lógica dos formulários de cadastro (dados do produto e cores/tamanhos), sem depender do
// Next: recebe o cliente já autenticado e devolve o próximo estado ou para onde redirecionar.
// A autorização é feita por quem chama (requireAdmin) e reforçada pelo banco (RLS).

export type ProductFormField = "name" | "price" | "description" | "category" | "slug";

export type FormState = {
  /** Mensagem geral (erro ou aviso de falha). */
  error?: string;
  /** Detalhes do erro, ex.: o que falta para o produto continuar publicado. */
  issues?: string[];
  fieldErrors?: Partial<Record<ProductFormField, string>>;
  /** Devolve o que foi digitado para o formulário não perder os dados ao errar. */
  values?: Partial<Record<ProductFormField, string>>;
  saved?: boolean;
};

export type FormOutcome = { redirectTo: string } | { state: FormState };

const uuid = z.uuid();

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function fieldValues(formData: FormData): NonNullable<FormState["values"]> {
  return {
    name: text(formData, "name"),
    price: text(formData, "price"),
    description: text(formData, "description"),
    category: text(formData, "categoryId"),
    slug: text(formData, "slug"),
  };
}

function errorState(error: ProductError, values?: FormState["values"]): FormOutcome {
  const state: FormState = { error: error.message, issues: error.issues, values };
  if (error.code === "slug_taken") state.fieldErrors = { slug: error.message };
  return { state };
}

/** Lê os campos comuns; devolve o erro de preço se o texto não for um valor válido. */
function readProductFields(formData: FormData) {
  const values = fieldValues(formData);
  const priceCents = parseBrlToCents(values.price ?? "");
  if (priceCents === null) {
    const state: FormState = {
      error: "Confira o preço.",
      fieldErrors: { price: "Informe um preço válido, como 79,90. Use 0 para um produto sem preço." },
      values,
    };
    return { ok: false as const, state };
  }
  return {
    ok: true as const,
    values,
    input: {
      name: values.name ?? "",
      description: values.description ?? "",
      basePriceCents: priceCents,
      categoryId: values.category ? values.category : null,
      slug: values.slug?.trim() ? values.slug.trim() : undefined,
    },
  };
}

/** Passo 1 (novo produto): cria o rascunho e segue para cores e tamanhos. */
export async function handleCreateProduct(client: SupabaseClient, formData: FormData): Promise<FormOutcome> {
  const fields = readProductFields(formData);
  if (!fields.ok) return { state: fields.state };

  const result = await createProduct(client, fields.input);
  if (!result.ok) return errorState(result.error, fields.values);
  return { redirectTo: `${routes.adminProductOptions(result.data.id)}?novo=1` };
}

/** Passo 1 (produto existente): salva os dados básicos. O endereço só muda se for informado. */
export async function handleUpdateProduct(client: SupabaseClient, formData: FormData): Promise<FormOutcome> {
  const productId = uuid.safeParse(text(formData, "productId"));
  if (!productId.success) return { state: { error: "Produto inválido." } };

  const fields = readProductFields(formData);
  if (!fields.ok) return { state: fields.state };

  const result = await updateProduct(client, productId.data, fields.input);
  if (!result.ok) return errorState(result.error, fields.values);
  return { state: { saved: true } };
}

/** Passo 2: salva cores, tamanhos e combinações (o servidor valida tudo de novo). */
export async function handleSaveStructure(client: SupabaseClient, formData: FormData): Promise<FormOutcome> {
  const productId = uuid.safeParse(text(formData, "productId"));
  if (!productId.success) return { state: { error: "Produto inválido." } };

  let structure: unknown;
  try {
    structure = JSON.parse(text(formData, "structure"));
  } catch {
    return { state: { error: "Não foi possível ler as combinações. Recarregue a página e tente de novo." } };
  }

  const result = await saveProductStructure(client, productId.data, structure as StructureInput);
  if (!result.ok) return errorState(result.error);
  return { state: { saved: true } };
}
