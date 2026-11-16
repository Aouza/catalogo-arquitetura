import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Buscadores podem ler a loja toda, menos a área administrativa e o login. Isto não protege nada
 * (a proteção é a autenticação): só evita que essas páginas apareçam em buscas.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/login"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
