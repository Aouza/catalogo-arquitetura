import Link from "next/link";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import { whatsappMessageLink } from "@/lib/whatsapp";
import {
  buildWhatsAppMessage,
  ctaState,
  galleryFor,
  priceView,
  productHref,
  type CtaState,
  type ProductDetail,
  type Selection,
} from "@/modules/catalogs/product-detail";
import type { ProductPageView } from "@/modules/catalogs/queries/get-product-page";
import { OptionPicker } from "./option-picker";
import { PriceDisplay } from "./price-display";
import { ProductGallery } from "./product-gallery";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { ThemeScope } from "./theme-scope";

const primary =
  "inline-flex min-h-12 w-full items-center justify-center rounded-control bg-action px-5 text-label font-semibold text-white transition-colors hover:bg-action-hover";
const disabled =
  "inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-control bg-surface-subtle px-5 text-label font-semibold text-fg-muted";

const joinNames = (names: string[]) => {
  const lower = names.map((name) => name.toLowerCase());
  return lower.length > 1 ? `${lower.slice(0, -1).join(", ")} e ${lower.at(-1)}` : (lower[0] ?? "");
};

function InterestButton({
  state,
  detail,
  selection,
  whatsappE164,
  baseUrl,
}: {
  state: CtaState;
  detail: ProductDetail;
  selection: Selection;
  whatsappE164?: string;
  baseUrl: string;
}) {
  if (state.kind === "ready") {
    const message = buildWhatsAppMessage({
      detail,
      selection,
      variant: state.variant,
      url: `${baseUrl}${productHref(detail, selection)}`,
    });
    const href = whatsappMessageLink(whatsappE164, message);

    if (!href) {
      return (
        <p className="rounded-card bg-surface-subtle p-4 text-body text-fg">
          Fale com a loja para saber mais sobre este produto.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <a href={href} target="_blank" rel="noopener noreferrer" className={primary}>
          Tenho interesse: falar no WhatsApp
        </a>
        <p className="text-caption text-fg-muted">
          Preço e disponibilidade serão confirmados pela loja. Nada é reservado nem comprado ao clicar.
        </p>
      </div>
    );
  }

  const note =
    state.kind === "choose"
      ? `Escolha ${joinNames(state.missing)} para continuar.`
      : state.reason === "product"
        ? "Este produto está indisponível no momento."
        : "Esta combinação está indisponível. Escolha outra.";

  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled aria-describedby="interest-note" className={disabled}>
        Tenho interesse
      </button>
      <p id="interest-note" aria-live="polite" className="text-label text-fg">
        {note}
      </p>
    </div>
  );
}

/** Página de um produto: fotos (que mudam com a cor), escolha de opções, preço e botão do WhatsApp. */
export function ProductDetailView({
  view,
  selection,
  baseUrl,
}: {
  view: ProductPageView;
  selection: Selection;
  baseUrl: string;
}) {
  const { store, theme, categories, detail } = view;
  const price = priceView(detail, selection);
  const state = ctaState(detail, selection);
  const images = galleryFor(detail, selection);

  return (
    <ThemeScope theme={theme}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-30 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader store={store} categories={categories} />
      <main id="conteudo" className="flex-1 py-4">
        <Container>
          <nav aria-label="Você está em" className="mb-3 text-label text-fg-muted">
            <Link href={routes.home()} className="inline-flex min-h-11 items-center hover:text-fg">
              Início
            </Link>
            <span aria-hidden="true"> / </span>
            <Link href={routes.products()} className="inline-flex min-h-11 items-center hover:text-fg">
              Produtos
            </Link>
          </nav>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr] lg:gap-10">
            <ProductGallery images={images} productName={detail.name} />

            <div className="flex flex-col gap-6">
              <div>
                <h1 className="font-heading text-h1 font-semibold break-words text-fg">{detail.name}</h1>
                <p className="mt-2 text-fg">
                  <PriceDisplay cents={price.cents} from={price.from} className="text-price font-semibold" />
                </p>
              </div>

              <OptionPicker detail={detail} selection={selection} />

              <InterestButton
                state={state}
                detail={detail}
                selection={selection}
                whatsappE164={store.whatsappE164}
                baseUrl={baseUrl}
              />

              {detail.description.trim() ? (
                <section aria-labelledby="description-title">
                  <h2 id="description-title" className="mb-1 font-heading text-h2 font-semibold text-fg">
                    Sobre o produto
                  </h2>
                  <p className="text-body whitespace-pre-line text-fg">{detail.description}</p>
                </section>
              ) : null}
            </div>
          </div>
        </Container>
      </main>
      <SiteFooter store={store} />
    </ThemeScope>
  );
}
