import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { siteUrl } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";
import { buildSitemapEntries, fetchSitemapData } from "@/modules/catalogs/queries/sitemap-data";

/** Mapa do site: só o que está publicado. Lido a cada pedido, para refletir o que o lojista publicou. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();

  const base = siteUrl();
  const client = createPublicClient();
  if (!client) return [{ url: base }];

  return buildSitemapEntries(await fetchSitemapData(client), base);
}
