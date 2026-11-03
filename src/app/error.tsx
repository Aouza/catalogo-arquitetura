"use client";

import { Container } from "@/components/ui/container";

export default function CatalogError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center py-16">
      <Container className="flex flex-col items-start gap-4">
        <p className="text-body text-fg">Não conseguimos carregar esta página.</p>
        <button
          type="button"
          onClick={reset}
          className="min-h-12 rounded-control bg-action px-5 text-label font-semibold text-white hover:bg-action-hover"
        >
          Tentar novamente
        </button>
      </Container>
    </main>
  );
}
