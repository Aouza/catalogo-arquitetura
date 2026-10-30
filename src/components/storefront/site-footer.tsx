import { Container } from "@/components/ui/container";
import { instagramUrl, whatsappLink } from "@/lib/whatsapp";
import type { StoreInfo } from "@/modules/catalogs/types";

export function SiteFooter({ store }: { store: StoreInfo }) {
  const whatsapp = whatsappLink(store.whatsappE164);
  const linkCls = "inline-flex min-h-11 items-center text-label font-medium text-action underline";
  return (
    <footer className="mt-12 border-t border-border bg-surface py-8">
      <Container className="flex flex-col gap-3">
        <p className="font-heading text-h2 font-semibold text-fg">{store.name}</p>
        {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={linkCls}>WhatsApp</a>}
        {store.instagram && (
          <a href={instagramUrl(store.instagram)} target="_blank" rel="noopener noreferrer" className={linkCls}>
            Instagram
          </a>
        )}
        {store.address && <p className="text-label text-fg-muted">{store.address}</p>}
        {store.hours && <p className="text-label text-fg-muted">{store.hours}</p>}
      </Container>
    </footer>
  );
}
