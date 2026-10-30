import { SearchIcon } from "@/components/ui/icons";
import { routes } from "@/lib/routes";

export function SearchField({ storeSlug, id }: { storeSlug: string; id: string }) {
  return (
    <form action={routes.search(storeSlug)} method="get" role="search" className="relative">
      <label htmlFor={id} className="sr-only">Buscar produtos</label>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-fg-muted" />
      <input
        id={id}
        name="q"
        type="search"
        enterKeyHint="search"
        placeholder="Buscar produtos..."
        className="h-11 w-full rounded-control border border-border-strong bg-surface pl-10 pr-3 text-body text-fg placeholder:text-fg-muted"
      />
    </form>
  );
}
