import { Container } from "@/components/ui/container";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/icons";
import { instagramUrl, whatsappLink } from "@/lib/whatsapp";
import type { StoreInfo } from "@/modules/catalogs/types";

export function SiteFooter({ store }: { store: StoreInfo }) {
  const whatsapp = whatsappLink(store.whatsappE164);
  const instagram = store.instagram ? instagramUrl(store.instagram) : null;
  const linkCls = "inline-flex min-h-11 items-center gap-2 text-label font-medium text-action underline";
  return (
    <footer className="mt-12 border-t border-border bg-surface py-8">
      <Container className="flex flex-col gap-1">
        <p className="mb-2 font-heading text-h2 font-semibold text-fg">{store.name}</p>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={linkCls}>
            <WhatsAppIcon className="size-5" /> WhatsApp
          </a>
        )}
        {instagram && (
          <a href={instagram} target="_blank" rel="noopener noreferrer" className={linkCls}>
            <InstagramIcon className="size-5" /> Instagram
          </a>
        )}
        {store.address && <p className="text-label text-fg-muted">{store.address}</p>}
        {store.hours && <p className="text-label text-fg-muted">{store.hours}</p>}
      </Container>
    </footer>
  );
}
