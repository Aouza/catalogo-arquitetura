import { vi } from "vitest";

// As funções de cache do Next só funcionam dentro do servidor do Next. Nos testes elas viram
// espiões: dá para conferir que as leituras públicas usam a etiqueta da vitrine e que as ações do
// painel a invalidam, sem precisar do runtime.
vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
}));
