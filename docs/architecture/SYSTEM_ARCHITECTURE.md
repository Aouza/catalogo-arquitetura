# Arquitetura do sistema

## Estilo
Monólito modular Next.js App Router, TypeScript strict, Tailwind e Supabase (Postgres/Auth/Storage). Deploy inicialmente Vercel. Escolhas propostas, não contratos irrevogáveis.

## Contexto
```text
Visitante --HTTPS--> Next.js (vitrine SSR/metadata) --leitura pública autorizada--> PostgreSQL
Administrador --HTTPS--> Next.js (admin/actions) --Auth/RLS--> PostgreSQL
Administrador --upload controlado--> Supabase Storage
Visitante --link contextual--> WhatsApp externo
```

## Fronteiras
- `app/`: rotas, renderização e endpoints finos.
- `modules/catalogs`: provisionamento e configuração do catálogo.
- `modules/products`: casos de uso, preços, opções e variações.
- `modules/categories`: organização do catálogo.
- `modules/media`: validação, upload, vinculação e remoção de imagens.
- `lib/supabase`: clientes server/browser e autenticação.

## Padrões
- Leituras públicas no servidor com seleção explícita de campos e filtros de publicação.
- Escritas apenas com sessão válida, checagem de membro e RLS.
- Serviços de aplicação independentes de Server Actions para permitir importação futura.
- Operações que criam/atualizam múltiplas tabelas devem ser transacionais (função SQL/RPC ou transação em camada segura); evitar estados parciais.
- Cache da vitrine pública (home, listas, produto e mapa do site): `use cache` com a etiqueta única `storefront` e prazo de 1 min de atualização em segundo plano e 10 min de validade máxima (`modules/catalogs/cache.ts`). Toda Server Action do painel que pode mudar o que o público vê chama `updateTag("storefront")` (um teste garante que nenhuma ação nova esqueça), então publicar, tirar do ar, mudar preço, foto ou disponibilidade aparece na hora. O prazo é a rede de segurança caso uma invalidação não alcance alguma instância do servidor (na Vercel as instâncias são efêmeras): nada fica velho por mais de 10 minutos. Erro do banco nas leituras públicas lança exceção (nunca devolve vitrine vazia), para não guardar uma falha em cache.
- Fotos públicas (`/fotos/...`) têm cache de navegador de 5 min e de CDN de 1 h; o otimizador de imagens do Next guarda as versões redimensionadas por mais tempo. Uma foto de produto tirado do ar pode, no pior caso, continuar acessível pelo endereço exato por algumas horas.
- SEO básico e metadados Open Graph para links compartilhados.

## URLs propostas
`/`; `/produtos`; `/busca`; `/categoria/{categorySlug}`; `/produto/{productSlug}`; `/admin` (autenticado). Loja única, sem slug de catálogo (ADR-004). Reservar `admin` e `api` como rotas da aplicação.

## Não objetivos
Microsserviços, event bus, filas, Redis, gateway de pagamentos e CMS genérico.

## Evolução
Segundo catálogo (fora do MVP, ver ADR-004) exigirá introduzir tenant; eventual SaaS exigirá billing, provisionamento self-service, limites, suporte, auditoria e políticas operacionais adicionais.
