-- Dados de desenvolvimento (aplicado em `supabase db reset`). Fictícios.
-- Não cria administradores: veja docs/delivery/SETUP.md.
insert into public.store_settings
  (name, description, whatsapp_e164, instagram, address, hours, logo_path, logo_full_path)
values (
  'Family Store Moda',
  'Moda infantil para todas as fases da infância.',
  '+5511999990000',
  '@lojaexemplo',
  'Rua das Flores, 123 — São Paulo/SP',
  'Seg a sáb, 9h às 18h',
  '/images/logo/logo-compact.png',
  '/images/logo/logo.png'
)
on conflict (id) do nothing;
