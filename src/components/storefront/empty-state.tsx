import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { whatsappLink } from "@/lib/whatsapp";

export function EmptyState({ whatsappE164 }: { whatsappE164?: string }) {
  const href = whatsappLink(whatsappE164);
  return (
    <section className="py-8">
      <Container>
        <div className="flex flex-col items-center gap-4 rounded-card bg-surface-subtle p-8 text-center">
          <p className="text-body text-fg">
            {href ? "Novidades chegando em breve. Fale com a gente pelo WhatsApp." : "Novidades chegando em breve."}
          </p>
          {href && (
            <ButtonLink href={href} external variant="primary">
              Falar pelo WhatsApp
            </ButtonLink>
          )}
        </div>
      </Container>
    </section>
  );
}
