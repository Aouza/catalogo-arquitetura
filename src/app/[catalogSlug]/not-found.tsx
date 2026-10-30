import Link from "next/link";
import { Container } from "@/components/ui/container";

export default function CatalogNotFound() {
  return (
    <main className="flex flex-1 items-center py-16">
      <Container className="flex flex-col items-start gap-4">
        <h1 className="font-heading text-h1 font-semibold text-fg">Página não encontrada</h1>
        <p className="text-body text-fg">Confira o endereço ou volte ao início.</p>
        <Link href="/" className="inline-flex min-h-12 items-center text-label font-semibold text-action underline">
          Voltar ao início
        </Link>
      </Container>
    </main>
  );
}
