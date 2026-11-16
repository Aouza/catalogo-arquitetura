/** Endereço público do site, sem barra no final (usado em links compartilháveis, como o do WhatsApp). */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
