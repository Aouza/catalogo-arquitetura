import Link from "next/link";
import { routes } from "@/lib/routes";

export type WizardStep = "data" | "options" | "photos" | "publish";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "data", label: "Dados do produto" },
  { id: "options", label: "Cores e tamanhos" },
  { id: "photos", label: "Fotos" },
  { id: "publish", label: "Publicar" },
];

/**
 * Indicador de passos. Os demais passos só são links depois que o produto existe (passo 1 salvo).
 * O passo atual é anunciado com `aria-current="step"`.
 */
export function WizardSteps({ current, productId }: { current: WizardStep; productId?: string }) {
  const hrefs: Record<WizardStep, string | null> = {
    data: productId ? routes.adminProduct(productId) : null,
    options: productId ? routes.adminProductOptions(productId) : null,
    photos: productId ? routes.adminProductPhotos(productId) : null,
    publish: productId ? routes.adminProductPublish(productId) : null,
  };

  return (
    <nav aria-label="Passos do cadastro">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((step, index) => {
          const isCurrent = step.id === current;
          const href = hrefs[step.id];
          const base =
            "inline-flex min-h-12 items-center gap-2 rounded-control border px-4 text-label font-semibold";
          const content = (
            <>
              <span
                aria-hidden="true"
                className={`inline-flex size-6 items-center justify-center rounded-full text-caption ${
                  isCurrent ? "bg-white text-action" : "bg-surface-subtle text-fg"
                }`}
              >
                {index + 1}
              </span>
              {step.label}
            </>
          );

          return (
            <li key={step.id}>
              {isCurrent ? (
                <span aria-current="step" className={`${base} border-action bg-action text-white`}>
                  {content}
                </span>
              ) : href ? (
                <Link href={href} className={`${base} border-border-strong bg-surface text-fg hover:border-action`}>
                  {content}
                </Link>
              ) : (
                <span className={`${base} border-border bg-surface text-fg-muted`}>{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
