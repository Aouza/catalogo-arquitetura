import Image from "next/image";
import { ButtonLink } from "@/components/ui/button-link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import type { HeroView } from "@/modules/catalogs/types";

// Faixa larga: no desktop o texto fica sobre a foto; a foto ocupa a direita e funde
// com o fundo bege (cor da parede da imagem) por um degradê na borda esquerda.
export function Hero({ hero }: { hero: HeroView }) {
  return (
    <section className="py-4">
      <Container>
        <div className="relative overflow-hidden rounded-hero bg-hero-wall lg:flex lg:min-h-[26rem] lg:items-center">
          {hero.imageUrl && (
            <div className="relative aspect-[4/5] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[72%] lg:[mask-image:linear-gradient(to_right,transparent,black_30%)]">
              <Image
                src={hero.imageUrl}
                alt={hero.imageAlt ?? ""}
                fill
                priority
                sizes="(min-width: 1024px) 72vw, 100vw"
                className="object-cover object-[70%_center] lg:object-[right_20%]"
              />
            </div>
          )}
          <div className="relative flex flex-col items-start gap-4 p-6 lg:max-w-[42%] lg:p-14">
            <h1 className="font-display text-[40px] font-normal leading-[44px] text-fg lg:text-[56px] lg:leading-[58px]">
              {hero.title}
            </h1>
            <p className="max-w-xs text-body text-fg">{hero.text}</p>
            <ButtonLink href={routes.products()} variant="primary">
              Explorar agora <ArrowRightIcon className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
