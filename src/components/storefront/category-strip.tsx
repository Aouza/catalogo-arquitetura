import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import type { CategoryView } from "@/modules/catalogs/types";

export function CategoryStrip({ categories }: { categories: CategoryView[] }) {
  if (categories.length === 0) return null;
  return (
    <nav aria-label="Categorias" className="py-4">
      <Container>
        <ul className="-mx-4 flex snap-x scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:px-0">
          {categories.map((category) => (
            <li key={category.slug} className="snap-start">
              <Link
                href={routes.category(category.slug)}
                className="flex w-28 flex-col items-center gap-2 lg:w-full"
              >
                {category.imageUrl ? (
                  <span className="relative block aspect-square w-full">
                    <Image src={category.imageUrl} alt="" fill sizes="(min-width: 1024px) 20vw, 112px" className="object-contain" />
                  </span>
                ) : (
                  <span className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-card bg-surface-subtle font-heading text-h2 font-semibold text-brand">
                    <span aria-hidden="true">{Array.from(category.name)[0]}</span>
                  </span>
                )}
                <span className="text-label font-medium text-fg">{category.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </nav>
  );
}
