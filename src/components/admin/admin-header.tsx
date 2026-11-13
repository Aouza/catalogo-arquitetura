import Link from "next/link";
import { routes } from "@/lib/routes";
import { logout } from "@/modules/auth/actions";
import { Container } from "@/components/ui/container";

const linkClass =
  "inline-flex min-h-12 items-center rounded-control px-3 text-label font-semibold text-fg hover:bg-surface-subtle";

export function AdminHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <Container className="flex items-center justify-between gap-2">
        <nav aria-label="Administração" className="flex items-center gap-1">
          <span className="mr-2 font-heading text-h2 font-bold text-fg">Administração</span>
          <Link href={routes.adminProducts()} className={linkClass}>
            Produtos
          </Link>
        </nav>
        <form action={logout}>
          <button type="submit" className={`${linkClass} text-fg-muted`}>
            Sair
          </button>
        </form>
      </Container>
    </header>
  );
}
