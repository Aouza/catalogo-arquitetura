import type { Metadata } from "next";
import { defaultHero } from "./default-hero";

/** Resumo de um texto para descrição de página: espaços normalizados, cortado em palavra inteira. */
export function summarize(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export type ShareInput = {
  title: string;
  description: string;
  /** Caminho oficial da página (sem domínio), ex.: "/produto/vestido-floral". */
  path: string;
  siteName: string;
  /** Foto da prévia do link. Caminho do próprio site ou endereço completo. */
  image?: { url: string; alt: string };
};

/**
 * Título, descrição, endereço oficial (canonical) e prévia do link (WhatsApp, Instagram, Google)
 * de uma página pública. Endereços relativos viram absolutos pelo `metadataBase` do layout.
 */
export function shareMetadata(input: ShareInput): Metadata {
  const { title, description, path, siteName, image } = input;
  const images = image ? [{ url: image.url, alt: image.alt }] : undefined;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName, type: "website", locale: "pt_BR", images },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: images?.map((i) => i.url) },
  };
}

/** Foto padrão da prévia quando a página não tem uma própria (a imagem de destaque da loja). */
export function defaultShareImage(): { url: string; alt: string } {
  return { url: defaultHero.imageUrl ?? "", alt: defaultHero.imageAlt ?? "" };
}
