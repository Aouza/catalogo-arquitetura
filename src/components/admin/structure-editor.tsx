"use client";

import { useActionState, useState } from "react";
import { centsToInput, formatPrice } from "@/lib/format";
import type { FormState } from "@/modules/products/admin-product-forms";
import {
  addValue,
  listCombos,
  removeValue,
  setCombo,
  toStructure,
  type EditorState,
  type ValueKind,
} from "@/modules/products/structure-editor";

const field =
  "min-h-12 w-full rounded-control border border-border-strong bg-surface px-4 text-body text-fg";
const smallButton =
  "inline-flex min-h-12 items-center justify-center rounded-control border border-border-strong bg-surface px-4 text-label font-semibold text-fg hover:border-action";

const SIZE_SUGGESTIONS = ["RN", "P", "M", "G", "2", "4", "6", "8", "10", "12"];

function ValueSection({
  kind,
  title,
  hint,
  values,
  suggestions,
  state,
  onChange,
}: {
  kind: ValueKind;
  title: string;
  hint: string;
  values: string[];
  suggestions?: string[];
  state: EditorState;
  onChange: (next: EditorState) => void;
}) {
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const inputId = `add-${kind}`;

  function add(label: string) {
    const result = addValue(state, kind, label);
    if (result.error) {
      setProblem(result.error);
      return;
    }
    setProblem(null);
    setDraft("");
    onChange(result.state);
  }

  const remaining = (suggestions ?? []).filter((suggestion) => !values.includes(suggestion));

  return (
    <section aria-labelledby={`${inputId}-title`} className="flex flex-col gap-3">
      <div>
        <h2 id={`${inputId}-title`} className="font-heading text-h2 font-bold text-fg">
          {title}
        </h2>
        <p className="text-label text-fg-muted">{hint}</p>
      </div>

      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {values.map((value) => (
            <li
              key={value}
              className="inline-flex min-h-12 items-center gap-1 rounded-control bg-surface-subtle pl-4 text-label font-semibold text-fg"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(removeValue(state, kind, value))}
                aria-label={`Remover ${value}`}
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-control text-fg-muted hover:text-accent-strong"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor={inputId} className="sr-only">
            {kind === "colors" ? "Nome da cor" : "Nome do tamanho"}
          </label>
          <input
            id={inputId}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setProblem(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add(draft);
              }
            }}
            placeholder={kind === "colors" ? "Ex.: Rosa" : "Ex.: 4"}
            maxLength={60}
            className={field}
            autoComplete="off"
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `${inputId}-problem` : undefined}
          />
        </div>
        <button type="button" onClick={() => add(draft)} className={smallButton}>
          Adicionar
        </button>
      </div>
      {problem ? (
        <p id={`${inputId}-problem`} role="alert" className="text-label text-accent-strong">
          {problem}
        </p>
      ) : null}

      {remaining.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-fg-muted">Sugestões:</span>
          {remaining.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-control border border-border bg-surface px-3 text-label text-fg hover:border-action"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function StructureEditor({
  productId,
  basePriceCents,
  initial,
  action,
}: {
  productId: string;
  basePriceCents: number;
  initial: EditorState;
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [editor, setEditor] = useState<EditorState>(initial);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  const combos = listCombos(editor);
  const result = toStructure(editor);
  const enabledCount = combos.filter((combo) => combo.config.enabled).length;

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="structure" value={result.ok ? JSON.stringify(result.structure) : ""} />

      <ValueSection
        kind="colors"
        title="Cores"
        hint="Opcional. Deixe vazio se o produto não tem variação de cor."
        values={editor.colors}
        state={editor}
        onChange={setEditor}
      />

      <ValueSection
        kind="sizes"
        title="Tamanhos"
        hint="Opcional. Deixe vazio se o produto não tem variação de tamanho."
        values={editor.sizes}
        suggestions={SIZE_SUGGESTIONS}
        state={editor}
        onChange={setEditor}
      />

      <section aria-labelledby="combos-title" className="flex flex-col gap-3">
        <div>
          <h2 id="combos-title" className="font-heading text-h2 font-bold text-fg">
            Combinações
          </h2>
          <p className="text-label text-fg-muted">
            O sistema montou todas as combinações. Desmarque as que não existem. Deixe o preço em branco para usar
            o preço base ({formatPrice(basePriceCents)}).
          </p>
          <p className="mt-1 text-label font-semibold text-fg" aria-live="polite">
            {enabledCount} de {combos.length} {combos.length === 1 ? "combinação marcada" : "combinações marcadas"}
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {combos.map((combo, index) => {
            const base = `combo-${index}`;
            const active = combo.config.enabled;
            return (
              <li
                key={combo.key}
                className={`rounded-card border p-4 ${active ? "border-border bg-surface" : "border-border bg-surface-subtle"}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor={`${base}-enabled`} className="flex min-h-12 items-center gap-3 text-body font-semibold text-fg">
                    <input
                      id={`${base}-enabled`}
                      type="checkbox"
                      checked={active}
                      onChange={(event) => setEditor(setCombo(editor, combo.key, { enabled: event.target.checked }))}
                      className="size-6 accent-action"
                    />
                    {combo.label}
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`${base}-price`} className="text-caption text-fg-muted">
                        Preço próprio (R$)
                      </label>
                      <input
                        id={`${base}-price`}
                        inputMode="decimal"
                        value={combo.config.price}
                        disabled={!active}
                        placeholder={centsToInput(basePriceCents)}
                        onChange={(event) => setEditor(setCombo(editor, combo.key, { price: event.target.value }))}
                        className={`${field} sm:w-40 disabled:opacity-50`}
                        autoComplete="off"
                      />
                    </div>
                    <label htmlFor={`${base}-available`} className="flex min-h-12 items-center gap-3 text-label text-fg">
                      <input
                        id={`${base}-available`}
                        type="checkbox"
                        checked={combo.config.available}
                        disabled={!active}
                        onChange={(event) =>
                          setEditor(setCombo(editor, combo.key, { available: event.target.checked }))
                        }
                        className="size-6 accent-action"
                      />
                      Disponível
                    </label>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {!result.ok ? (
        <ul role="alert" className="list-disc rounded-card border border-accent-strong bg-surface p-4 pl-8 text-body text-accent-strong">
          {result.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {state.error ? (
        <div role="alert" className="rounded-card border border-accent-strong bg-surface p-4 text-body text-accent-strong">
          <p>{state.error}</p>
          {state.issues && state.issues.length > 0 ? (
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
          Cores, tamanhos e combinações salvos.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !result.ok}
        className="inline-flex min-h-12 items-center justify-center rounded-control bg-action px-5 text-label font-semibold text-white transition-colors hover:bg-action-hover disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar combinações"}
      </button>
    </form>
  );
}
