import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { WhatsAppIcon } from "@/components/ui/icons";
import { routes } from "@/lib/routes";
import { whatsappLink } from "@/lib/whatsapp";
import type { CategoryView, StoreInfo } from "@/modules/catalogs/types";
import { CategoryDrawer } from "./category-drawer";
import { SearchField } from "./search-field";

export function SiteHeader({ store, categories }: { store: StoreInfo; categories: CategoryView[] }) {
  const whatsapp = whatsappLink(store.whatsappE164);
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <Container className="flex h-16 items-center gap-3">
        {categories.length > 0 ? (
          <CategoryDrawer storeSlug={store.slug} categories={categories} />
        ) : (
          <span aria-hidden="true" className="size-11 lg:hidden" />
        )}
        <Link
          href={routes.catalog(store.slug)}
          className="flex-1 text-center font-heading text-h2 font-bold text-fg lg:flex-none lg:text-left"
        >
          {store.logoUrl ? (
            <Image src={store.logoUrl} alt={store.name} width={120} height={32} className="mx-auto h-8 w-auto lg:mx-0" />
          ) : (
            store.name
          )}
        </Link>
        <nav aria-label="Menu principal" className={categories.length > 0 ? "hidden lg:block" : "hidden"}>
          <ul className="flex gap-6">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={routes.category(store.slug, category.slug)} className="text-label font-medium text-fg">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto hidden w-72 lg:block">
          <SearchField storeSlug={store.slug} id="search-desktop" />
        </div>
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Conversar pelo WhatsApp"
            className="grid size-11 place-items-center text-fg"
          >
            <WhatsAppIcon />
          </a>
        ) : (
          <span aria-hidden="true" className="size-11 lg:hidden" />
        )}
      </Container>
      <div className="pb-3 lg:hidden">
        <Container>
          <SearchField storeSlug={store.slug} id="search-mobile" />
        </Container>
      </div>
    </header>
  );
}
