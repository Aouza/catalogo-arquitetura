import Image from "next/image";
import { ButtonLink } from "@/components/ui/button-link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import type { HeroView } from "@/modules/catalogs/types";

export function Hero({ storeSlug, hero }: { storeSlug: string; hero: HeroView }) {
  return (
    <section className="py-4">
      <Container>
        <div className="grid overflow-hidden rounded-hero bg-surface-subtle lg:grid-cols-2">
          {hero.imageUrl && (
            <div className="relative aspect-[4/5] lg:order-2 lg:aspect-[16/9]">
              <Image
                src={hero.imageUrl}
                alt={hero.imageAlt ?? ""}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          )}
          <div className="flex flex-col items-start justify-center gap-3 p-6 lg:p-10">
            <h1 className="font-heading text-display font-bold text-fg">{hero.title}</h1>
            <p className="text-body text-fg">{hero.text}</p>
            <ButtonLink href={routes.products(storeSlug)} variant="secondary">
              Explorar produtos <ArrowRightIcon className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
