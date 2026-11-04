import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Conveniência: renova a sessão e evita renderizar /admin para anônimos.
// NÃO é a autorização: `requireAdmin()` (servidor) e a RLS é que protegem os dados.
export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request);

  if (request.nextUrl.pathname.startsWith("/admin") && !isAuthenticated) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
