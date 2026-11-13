"use client";

import { useActionState, useState } from "react";
import type { CategoryOption } from "@/modules/categories/list-categories";
import type { FormState } from "@/modules/products/admin-product-forms";

export type ProductDataDefaults = {
  productId?: string;
  name: string;
  /** Preço em texto de campo, ex.: "79,90". */
  price: string;
  description: string;
  categoryId: string;
  slug: string;
};

const field =
  "min-h-12 w-full rounded-control border border-border-strong bg-surface px-4 text-body text-fg";
const label = "text-label font-semibold text-fg";
const hint = "text-caption text-fg-muted";
const errorText = "text-label text-accent-strong";

export function ProductDataForm({
  mode,
  action,
  categories,
  defaults,
}: {
  mode: "create" | "edit";
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  categories: CategoryOption[];
  defaults: ProductDataDefaults;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  // Campos controlados: o que o lojista digitou nunca se perde, nem quando há erro.
  const [name, setName] = useState(defaults.name);
  const [price, setPrice] = useState(defaults.price);
  const [description, setDescription] = useState(defaults.description);
  const [categoryId, setCategoryId] = useState(defaults.categoryId);
  const [slug, setSlug] = useState(defaults.slug);

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {defaults.productId ? <input type="hidden" name="productId" value={defaults.productId} /> : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="product-name" className={label}>
          Nome do produto
        </label>
        <input
          id="product-name"
          name="name"
          required
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={field}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="product-price" className={label}>
          Preço base (R$)
        </label>
        <input
          id="product-price"
          name="price"
          required
          inputMode="decimal"
          placeholder="79,90"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          className={field}
          aria-invalid={errors.price ? true : undefined}
          aria-describedby={errors.price ? "product-price-error" : "product-price-hint"}
          autoComplete="off"
        />
        {errors.price ? (
          <p id="product-price-error" className={errorText}>
            {errors.price}
          </p>
        ) : (
          <p id="product-price-hint" className={hint}>
            Cada combinação pode ter um preço próprio no passo seguinte.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="product-description" className={label}>
          Descrição (opcional)
        </label>
        <textarea
          id="product-description"
          name="description"
          rows={4}
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={`${field} py-3`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="product-category" className={label}>
          Categoria
        </label>
        <select
          id="product-category"
          name="categoryId"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className={field}
        >
          <option value="">Sem categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <details className="rounded-card border border-border bg-surface-subtle p-4" open={Boolean(errors.slug)}>
        <summary className="cursor-pointer text-label font-semibold text-fg">Personalizar o endereço (link)</summary>
        <div className="mt-3 flex flex-col gap-1">
          <label htmlFor="product-slug" className={label}>
            Endereço do produto
          </label>
          <input
            id="product-slug"
            name="slug"
            maxLength={80}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className={field}
            placeholder={mode === "create" ? "Deixe em branco para criar a partir do nome" : "Mantém o endereço atual"}
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={errors.slug ? "product-slug-error" : "product-slug-hint"}
            autoComplete="off"
          />
          {errors.slug ? (
            <p id="product-slug-error" className={errorText}>
              {errors.slug}
            </p>
          ) : (
            <p id="product-slug-hint" className={hint}>
              Só letras minúsculas, números e hifens.
              {mode === "edit" ? " Mudar o endereço faz os links já compartilhados deixarem de funcionar." : ""}
            </p>
          )}
        </div>
      </details>

      {state.error && !errors.price ? (
        <div role="alert" className="rounded-card border border-accent-strong bg-surface p-4 text-body text-accent-strong">
          <p>{state.error}</p>
          {state.issues && state.issues.length > 1 ? (
            <ul className="mt-2 list-disc pl-5">
              {state.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {state.saved ? (
        <p role="status" className="rounded-card border border-action bg-surface-subtle p-4 text-body text-fg">
          Dados salvos.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center rounded-control bg-action px-5 text-label font-semibold text-white transition-colors hover:bg-action-hover disabled:opacity-60"
      >
        {pending ? "Salvando…" : mode === "create" ? "Salvar e continuar" : "Salvar dados"}
      </button>
    </form>
  );
}
