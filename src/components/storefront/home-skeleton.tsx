import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export function HomeSkeleton() {
  return (
    <div role="status" aria-label="Carregando" className="min-h-dvh">
      <div className="h-16 border-b border-border bg-surface" />
      <Container className="grid grid-cols-2 gap-3 py-6 min-[600px]:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5]" />
        ))}
      </Container>
    </div>
  );
}
