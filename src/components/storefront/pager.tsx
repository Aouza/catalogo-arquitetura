import Link from "next/link";

const base =
  "inline-flex min-h-12 items-center justify-center rounded-control border border-border-strong bg-surface px-5 text-label font-semibold text-fg hover:border-action";

/** Paginação por links (funciona sem JavaScript e deixa cada página compartilhável). */
export function Pager({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Paginação" className="mt-6 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={base}>
          Anterior
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <p className="text-label text-fg-muted">
        Página {page} de {totalPages}
      </p>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} rel="next" className={base}>
          Próxima
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
