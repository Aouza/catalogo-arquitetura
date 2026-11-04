import { SearchIcon } from "@/components/ui/icons";
import { routes } from "@/lib/routes";

export function SearchField({ id }: { id: string }) {
  return (
    <form action={routes.search()} method="get" role="search" className="relative">
      <label htmlFor={id} className="sr-only">Buscar produtos</label>
      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fg" />
      <input
        id={id}
        name="q"
        type="search"
        enterKeyHint="search"
        placeholder="Buscar produtos..."
        className="h-11 w-full rounded-full bg-fg/5 pl-12 pr-4 text-label text-fg placeholder:text-fg-muted"
      />
    </form>
  );
}
