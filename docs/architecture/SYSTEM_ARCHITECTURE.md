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
- Cache/revalidação por catálogo e produto; invalidar ao publicar/editar/arquivar.
- SEO básico e metadados Open Graph para links compartilhados.

## URLs propostas
`/{catalogSlug}`; `/{catalogSlug}/produto/{productSlug}`; `/admin` (autenticado). Reservar slugs como `admin`, `api`, `_next`. Confirmar estratégia antes de implementar rotas.

## Não objetivos
Microsserviços, event bus, filas, Redis, gateway de pagamentos e CMS genérico.

## Evolução
Segundo catálogo na mesma base; eventual SaaS exigirá billing, provisionamento self-service, limites, suporte, auditoria e políticas operacionais adicionais.
