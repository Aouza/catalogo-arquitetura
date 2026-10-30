import Image from "next/image";
import Link from "next/link";
import { routes } from "@/lib/routes";
import type { ProductView } from "@/modules/catalogs/types";
import { ImagePlaceholder } from "./image-placeholder";
import { PriceDisplay } from "./price-display";

type Props = { storeSlug: string; product: ProductView; priority?: boolean };

export function ProductCard({ storeSlug, product, priority = false }: Props) {
  return (
    <li>
      <Link
        href={routes.product(storeSlug, product.slug)}
        className="block overflow-hidden rounded-card border border-border bg-surface"
      >
        <div className="relative aspect-[4/5] bg-surface-subtle">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 600px) 33vw, 50vw"
              className="object-cover"
            />
          ) : (
            <ImagePlaceholder />
          )}
          {!product.isAvailable && (
            <span className="absolute left-2 top-2 rounded-control bg-surface px-2 py-1 text-label font-medium text-fg">
              Indisponível
            </span>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 min-h-10 text-label font-medium text-fg">{product.name}</h3>
          <PriceDisplay cents={product.basePriceCents} className="mt-1 block text-label font-semibold text-fg" />
        </div>
      </Link>
    </li>
  );
}
