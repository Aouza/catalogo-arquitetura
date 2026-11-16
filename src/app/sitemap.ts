import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { siteUrl } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";
import { STOREFRONT_LIFE, STOREFRONT_TAG } from "@/modules/catalogs/cache";
import { buildSitemapEntries, fetchSitemapData } from "@/modules/catalogs/queries/sitemap-data";

async function loadSitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheTag(STOREFRONT_TAG);
  cacheLife(STOREFRONT_LIFE);

  const base = siteUrl();
  const client = createPublicClient();
  if (!client) return [{ url: base }];

  return buildSitemapEntries(await fetchSitemapData(client), base);
}

/**
 * Mapa do site: só o que está publicado. Guardado em cache e renovado junto com a vitrine, então
 * reflete o que o lojista publicou ou tirou do ar.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return loadSitemap();
}
