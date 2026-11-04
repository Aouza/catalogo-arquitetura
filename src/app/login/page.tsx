import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="py-12">
      <Container className="max-w-md">
        <h1 className="font-heading text-2xl font-bold text-fg">Área administrativa</h1>
        <p className="mt-2 mb-6 text-body text-fg-muted">Entre com seu e-mail e senha.</p>
        <LoginForm />
        <p className="mt-6 text-body">
          <Link href={routes.home()} className="text-action underline">
            Voltar para a loja
          </Link>
        </p>
      </Container>
    </main>
  );
}
