import Image from "next/image";
import type { DetailImage } from "@/modules/catalogs/product-detail";
import { ImagePlaceholder } from "./image-placeholder";

/**
 * Galeria em faixa horizontal com "encaixe" ao rolar (funciona sem JavaScript e com o dedo no
 * celular). A primeira foto carrega com prioridade, por ser a que aparece no topo da página.
 */
export function ProductGallery({ images, productName }: { images: DetailImage[]; productName: string }) {
  if (images.length === 0) {
    return (
      <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-surface-subtle">
        <ImagePlaceholder />
      </div>
    );
  }

  return (
    <div role="group" aria-roledescription="galeria" aria-label={`Fotos de ${productName}`}>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0">
        {images.map((image, index) => (
          <li
            key={image.id}
            className="relative aspect-[4/5] w-[85%] shrink-0 snap-center overflow-hidden rounded-card bg-surface-subtle lg:w-auto"
          >
            <Image
              src={image.path}
              alt={image.alt || `${productName}, foto ${index + 1} de ${images.length}`}
              fill
              priority={index === 0}
              sizes="(min-width: 1024px) 30vw, 85vw"
              className="object-cover"
            />
          </li>
        ))}
      </ul>
      {images.length > 1 ? (
        <p className="mt-1 text-caption text-fg-muted">{images.length} fotos. Deslize para ver mais.</p>
      ) : null}
    </div>
  );
}
