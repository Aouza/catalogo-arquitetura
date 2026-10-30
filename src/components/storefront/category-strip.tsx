import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import type { CategoryView } from "@/modules/catalogs/types";

export function CategoryStrip({ storeSlug, categories }: { storeSlug: string; categories: CategoryView[] }) {
  if (categories.length === 0) return null;
  return (
    <nav aria-label="Categorias" className="py-4">
      <Container>
        <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
          {categories.map((category) => (
            <li key={category.slug} className="snap-start">
              <Link
                href={routes.category(storeSlug, category.slug)}
                className="flex min-w-[72px] flex-col items-center gap-2"
              >
                <span className="relative grid size-16 place-items-center overflow-hidden rounded-full bg-surface-subtle font-heading text-h2 font-semibold text-brand">
                  {category.imageUrl ? (
                    <Image src={category.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                  ) : (
                    category.name.charAt(0)
                  )}
                </span>
                <span className="text-label font-medium text-fg">{category.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </nav>
  );
}
