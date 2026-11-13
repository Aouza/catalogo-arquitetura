import type { ProductImageWithUrl } from "@/modules/media/list-product-images";

type Action = (formData: FormData) => void | Promise<void>;

const field =
  "min-h-12 w-full rounded-control border border-border-strong bg-surface px-4 text-body text-fg";
const button =
  "inline-flex min-h-12 items-center justify-center rounded-control border border-border-strong bg-surface px-4 text-label font-semibold text-fg hover:border-action disabled:opacity-50";
const dangerButton =
  "inline-flex min-h-12 items-center justify-center rounded-control bg-accent-strong px-4 text-label font-semibold text-white";

/**
 * Galeria do produto: a primeira foto é a capa. Cada foto tem texto alternativo, cor, ordem e
 * exclusão, tudo por formulários (funciona sem JavaScript).
 */
export function PhotoGrid({
  productId,
  images,
  colors,
  returnTo,
  updateImage,
  moveImage,
  deleteImage,
}: {
  productId: string;
  images: ProductImageWithUrl[];
  colors: { id: string; label: string }[];
  returnTo: string;
  updateImage: Action;
  moveImage: Action;
  deleteImage: Action;
}) {
  const colorLabel = new Map(colors.map((color) => [color.id, color.label]));

  if (images.length === 0) {
    return (
      <p className="rounded-card bg-surface-subtle p-8 text-center text-body text-fg">
        Nenhuma foto ainda. Envie ao menos uma para poder publicar o produto.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {images.map((image, index) => {
        const position = index + 1;
        const colorName = image.optionValueId ? colorLabel.get(image.optionValueId) : undefined;

        return (
          <li key={image.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
            <div className="relative">
              {image.url ? (
                // URL assinada temporária de um bucket privado: <img> simples, sem otimização.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.url}
                  alt={image.altText || `Foto ${position} do produto`}
                  className="aspect-square w-full rounded-card bg-surface-subtle object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-card bg-surface-subtle text-label text-fg-muted">
                  Pré-visualização indisponível
                </div>
              )}
              {index === 0 ? (
                <span className="absolute top-2 left-2 rounded-control bg-action px-2 py-1 text-caption font-semibold text-white">
                  Capa
                </span>
              ) : null}
            </div>

            <p className="text-label text-fg-muted">
              Foto {position} de {images.length} ·{" "}
              <span className="font-semibold text-fg">{colorName ? `Cor: ${colorName}` : "Foto geral"}</span>
            </p>

            <form action={updateImage} className="flex flex-col gap-3">
              <input type="hidden" name="imageId" value={image.id} />
              <input type="hidden" name="returnTo" value={returnTo} />

              <div className="flex flex-col gap-1">
                <label htmlFor={`alt-${image.id}`} className="text-label font-semibold text-fg">
                  Descrição da foto
                </label>
                <input
                  id={`alt-${image.id}`}
                  name="altText"
                  defaultValue={image.altText}
                  maxLength={200}
                  placeholder="Ex.: Vestido rosa, vista frontal"
                  className={field}
                  autoComplete="off"
                />
              </div>

              {colors.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <label htmlFor={`color-${image.id}`} className="text-label font-semibold text-fg">
                    Aparece quando a cor escolhida for
                  </label>
                  <select
                    id={`color-${image.id}`}
                    name="optionValueId"
                    defaultValue={image.optionValueId ?? ""}
                    className={field}
                  >
                    <option value="">Todas as cores (foto geral)</option>
                    {colors.map((color) => (
                      <option key={color.id} value={color.id}>
                        {color.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input type="hidden" name="optionValueId" value="" />
              )}

              <button type="submit" className={button}>
                Salvar foto
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {(["up", "down"] as const).map((direction) => {
                const disabled = direction === "up" ? index === 0 : index === images.length - 1;
                return (
                  <form key={direction} action={moveImage}>
                    <input type="hidden" name="productId" value={productId} />
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="direction" value={direction} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button
                      type="submit"
                      disabled={disabled}
                      className={button}
                      aria-label={`Mover a foto ${position} para ${direction === "up" ? "antes" : "depois"}`}
                    >
                      {direction === "up" ? "← Antes" : "Depois →"}
                    </button>
                  </form>
                );
              })}

              <details>
                <summary className={`${button} cursor-pointer list-none`}>Excluir</summary>
                <div className="mt-2 flex max-w-xs flex-col gap-2 rounded-card border border-border bg-surface-subtle p-3">
                  <p className="text-label text-fg">Excluir esta foto? Não dá para desfazer.</p>
                  <form action={deleteImage}>
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button type="submit" className={dangerButton}>
                      Confirmar exclusão
                    </button>
                  </form>
                </div>
              </details>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
