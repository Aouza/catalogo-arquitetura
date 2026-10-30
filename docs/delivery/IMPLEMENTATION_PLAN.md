# Plano de implementação por épicos

## EPIC 00 — Fundação
- Criar repositório Next.js TypeScript strict, lint/testes, variáveis de ambiente e Supabase local.
- Configurar CI com typecheck, lint, testes.
**Aceite:** pipeline verde e documentação de setup.

## EPIC 01 — Catálogos, autenticação e autorização
- Migrations de catálogo e membros; login; rotas protegidas; RLS testada.
**Aceite:** admin A não acessa dados de B; anônimo não escreve.

## EPIC 02 — Domínio de produtos
- Categorias, produtos, opções, valores, variantes, preço efetivo e constraints.
- Casos de uso de criação/edição/publicação.
**Aceite:** combinação duplicada rejeitada; override e fallback corretos; rascunho invisível.

## EPIC 03 — Imagens
- Upload validado, ordenação, fotos gerais e por cor, limpeza segura.
**Aceite:** trocar cor altera galeria; não permite vincular foto a opção de outro produto.

## EPIC 04 — Admin
- Listagem, filtros básicos, cadastro guiado, revisão de combinações, publicação e disponibilidade.
**Aceite:** usuário cadastra vestido com duas cores e dois tamanhos sem criar combinações uma a uma.

## EPIC 05 — Vitrine e WhatsApp
- Página do catálogo, detalhe, seleção de opções, estado indisponível, CTA WhatsApp.
**Aceite:** mensagem identifica variante e preço; links diretos funcionam no celular.

## EPIC 06 — SEO, qualidade e produção
- Metadata, OG, sitemap, acessibilidade, performance, backups, logs e checklist de deploy.
**Aceite:** páginas publicadas compartilháveis e indexáveis; regressões e RLS testadas.

## EPIC 07 — Evoluções (não MVP)
- Importação CSV/XLSX com prévia e relatório de erros; duplicação avançada; segundo catálogo; domínio próprio; SaaS.

## Ordem de trabalho
Uma tarefa por vez. Para cada tarefa: objetivo, arquivos previstos, mudanças no esquema, testes, riscos, critérios de aceitação e resumo do resultado. Não iniciar próximo épico com migrações incompletas.
