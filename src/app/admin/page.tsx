import { Container } from "@/components/ui/container";
import { logout } from "@/modules/auth/actions";
import { requireAdmin } from "@/modules/auth/require-admin";

export default async function AdminHomePage() {
  const admin = await requireAdmin();

  return (
    <main className="py-12">
      <Container>
        <h1 className="font-heading text-2xl font-bold text-fg">Administração</h1>
        <p className="mt-2 mb-6 text-body text-fg-muted">Você entrou como {admin.email}.</p>
        <form action={logout}>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center rounded-control border border-border-strong bg-surface px-5 text-label font-semibold text-fg hover:border-action"
          >
            Sair
          </button>
        </form>
      </Container>
    </main>
  );
}
