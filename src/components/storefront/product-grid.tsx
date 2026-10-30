import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import type { ProductView } from "@/modules/catalogs/types";
import { ProductCard } from "./product-card";

type Props = { storeSlug: string; products: ProductView[]; order: "published_at" | "default" };

export function ProductGrid({ storeSlug, products, order }: Props) {
  return (
    <section aria-labelledby="products-title" className="py-6">
      <Container>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="products-title" className="font-heading text-h2 font-semibold text-fg">
            {order === "published_at" ? "Novidades" : "Produtos"}
          </h2>
          <Link
            href={routes.products(storeSlug)}
            className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-action"
          >
            Ver todos <ArrowRightIcon className="size-4" />
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {products.map((product, index) => (
            <ProductCard key={product.slug} storeSlug={storeSlug} product={product} priority={index < 2} />
          ))}
        </ul>
      </Container>
    </section>
  );
}
