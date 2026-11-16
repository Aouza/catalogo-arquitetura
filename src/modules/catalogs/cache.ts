/**
 * Cache das leituras públicas da vitrine (home, listas, produto e mapa do site).
 *
 * - Todas levam a mesma etiqueta: qualquer alteração do lojista no painel invalida a vitrine
 *   inteira na hora (`updateTag` nas ações do servidor). É simples e seguro para uma loja pequena.
 * - O prazo é a rede de segurança: mesmo que uma invalidação não chegue a alguma instância do
 *   servidor, nada fica desatualizado por mais de alguns minutos. Um produto tirado do ar some da
 *   vitrine em no máximo `expire`, no pior caso.
 * - `expire` precisa ser de 5 minutos ou mais, senão o Next não pré-renderiza a página.
 */
export const STOREFRONT_TAG = "storefront";

export const STOREFRONT_LIFE = {
  /** O navegador pode reaproveitar a página por 1 minuto ao navegar. */
  stale: 60,
  /** Depois de 1 minuto, o próximo acesso regenera a página em segundo plano. */
  revalidate: 60,
  /** Limite máximo: depois de 10 minutos, nenhuma cópia antiga é servida. */
  expire: 600,
} as const;
