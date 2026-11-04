import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { WhatsAppOutlineIcon } from "@/components/ui/icons";
import { routes } from "@/lib/routes";
import { whatsappLink } from "@/lib/whatsapp";
import type { CategoryView, StoreInfo } from "@/modules/catalogs/types";
import { CategoryDrawer } from "./category-drawer";
import { SearchField } from "./search-field";

export function SiteHeader({ store, categories }: { store: StoreInfo; categories: CategoryView[] }) {
  const whatsapp = whatsappLink(store.whatsappE164);
  return (
    <header className="sticky top-0 z-20 bg-bg">
      <Container className="flex h-16 items-center gap-3 lg:h-20">
        {categories.length > 0 ? (
          <CategoryDrawer categories={categories} />
        ) : (
          <span aria-hidden="true" className="size-11 lg:hidden" />
        )}
        <Link
          href={routes.home()}
          className="flex min-h-11 flex-1 items-center justify-center font-heading text-h2 font-bold text-fg lg:flex-none lg:justify-start"
        >
          {store.logoUrl ? (
            <>
              <Image
                src={store.logoUrl}
                alt={store.name}
                width={214}
                height={40}
                priority
                className={`mx-auto h-8 w-auto lg:mx-0 ${store.logoFullUrl ? "lg:hidden" : "lg:h-10"}`}
              />
              {store.logoFullUrl && (
                <Image
                  src={store.logoFullUrl}
                  alt={store.name}
                  width={201}
                  height={48}
                  priority
                  className="hidden h-12 w-auto lg:block"
                />
              )}
            </>
          ) : (
            store.name
          )}
        </Link>
        <nav aria-label="Menu principal" className={categories.length > 0 ? "hidden lg:ml-14 lg:block" : "hidden"}>
          <ul className="flex gap-9">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={routes.category(category.slug)} className="inline-flex min-h-11 items-center text-label font-medium text-fg">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto hidden w-64 lg:block">
          <SearchField id="search-desktop" />
        </div>
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Conversar pelo WhatsApp"
            className="grid size-11 place-items-center text-fg hover:text-action"
          >
            <WhatsAppOutlineIcon />
          </a>
        ) : (
          <span aria-hidden="true" className="size-11 lg:hidden" />
        )}
      </Container>
      <div className="pb-3 lg:hidden">
        <Container>
          <SearchField id="search-mobile" />
        </Container>
      </div>
    </header>
  );
}
