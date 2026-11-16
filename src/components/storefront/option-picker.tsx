import Link from "next/link";
import {
  productHref,
  selectValue,
  valueState,
  type ProductDetail,
  type Selection,
} from "@/modules/catalogs/product-detail";

const base = "inline-flex min-h-12 min-w-12 items-center justify-center rounded-control border px-4 text-label font-semibold";

/**
 * Escolha de cor, tamanho e demais opções por links: a escolha vai na URL, então funciona sem
 * JavaScript e o endereço já abre com a combinação certa. Só não é clicável o valor sem nenhuma
 * combinação. Valor que não combina com a escolha atual continua clicável (a outra escolha é
 * solta, nunca vira uma combinação inexistente); o esgotado fica riscado, mas pode ser visto.
 */
export function OptionPicker({ detail, selection }: { detail: ProductDetail; selection: Selection }) {
  if (detail.options.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {detail.options.map((option) => {
        const chosen = option.values.find((value) => value.code === selection[option.code]);
        const labelId = `option-${option.code}`;

        return (
          <div key={option.code} role="group" aria-labelledby={labelId}>
            <p id={labelId} className="mb-2 text-label font-semibold text-fg">
              {option.name}
              {chosen ? <span className="font-normal text-fg-muted">: {chosen.label}</span> : null}
            </p>
            <ul className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const state = valueState(detail, selection, option.code, value.code);

                if (!state.exists) {
                  return (
                    <li key={value.code}>
                      <span
                        aria-disabled="true"
                        className={`${base} cursor-not-allowed border-border bg-surface text-fg-muted line-through opacity-50`}
                      >
                        {value.label}
                        <span className="sr-only"> (sem combinações)</span>
                      </span>
                    </li>
                  );
                }

                const href = productHref(detail, selectValue(detail, selection, option.code, value.code));
                const style = state.selected
                  ? "border-action bg-action text-white"
                  : !state.compatible
                    ? "border-dashed border-border-strong bg-surface text-fg-muted hover:border-action"
                    : state.available
                      ? "border-border-strong bg-surface text-fg hover:border-action"
                      : "border-dashed border-border-strong bg-surface text-fg-muted line-through hover:border-action";

                return (
                  <li key={value.code}>
                    <Link
                      href={href}
                      scroll={false}
                      aria-current={state.selected ? "true" : undefined}
                      className={`${base} ${style}`}
                    >
                      {value.label}
                      {state.selected || state.compatible ? null : (
                        <span className="sr-only"> (não combina com a escolha atual; a outra escolha será desfeita)</span>
                      )}
                      {state.available ? null : <span className="sr-only"> (indisponível)</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
