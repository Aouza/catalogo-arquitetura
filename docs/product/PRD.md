# PRD — Catálogo Digital

**Status:** baseline para validação · **Versão:** 0.1

## Problema
Pequeno vendedor precisa divulgar aproximadamente 100 produtos infantis com fotos, tamanhos, cores, preços e disponibilidade, principalmente por WhatsApp e Instagram, sem gerenciar transações online.

## Objetivo
Permitir que o vendedor publique e mantenha uma vitrine mobile-first e que visitantes descubram produtos, escolham variações existentes e iniciem contato contextualizado pelo WhatsApp.

## Usuários
- Visitante: acessa por link compartilhado, explora e consulta produto.
- Administrador do catálogo: cadastra, edita, publica, arquiva e gerencia disponibilidade.
- Administrador da plataforma (operação interna): provisiona catálogos e acessos no MVP; sem autoatendimento.

## Requisitos funcionais (MVP)
| ID | Requisito | Prioridade |
|---|---|---|
| RF-01 | Vitrine pública por slug de catálogo | P0 |
| RF-02 | Listagem de produtos publicados com fotos, nome, preço e disponibilidade | P0 |
| RF-03 | Página de detalhes com galeria e seleção de opções | P0 |
| RF-04 | Alterar galeria ao escolher cor com fotos vinculadas | P0 |
| RF-05 | Mostrar preço efetivo da variação selecionada | P0 |
| RF-06 | Link WhatsApp com nome, atributos, preço e URL da página | P0 |
| RF-07 | Login administrativo e isolamento por catálogo | P0 |
| RF-08 | CRUD de produtos, categorias, opções, variações e imagens | P0 |
| RF-09 | Publicar, manter rascunho e arquivar produto | P0 |
| RF-10 | Marcar variações disponíveis/indisponíveis sem quantidade | P0 |
| RF-11 | Busca simples e filtro por categoria | P1 |
| RF-12 | Duplicar cadastro de produto | P1 |
| RF-13 | Personalização básica do catálogo (nome, descrição, logo, WhatsApp) | P1 |
| RF-14 | Metadados públicos, sitemap e compartilhamento social | P1 |

## Requisitos não funcionais
- Mobile-first; navegação acessível por teclado; rótulos e feedback de formulário.
- Páginas públicas com renderização indexável; links diretos estáveis.
- RLS e checagem de autorização no servidor; armazenamento seguro de mídia.
- Performance proporcional a ~100 produtos, sem infraestrutura distribuída.
- Observabilidade mínima de erros; backup e procedimento de recuperação antes de produção.

## Fora do escopo
Checkout, pagamentos, carrinho, pedidos, reservas, controle numérico de estoque, importação de planilha, integrações de ERP, autoinscrição de lojistas, cobrança recorrente, domínio próprio por catálogo e analytics avançado.

## Métricas iniciais (propostas)
Produtos publicados; tempo para cadastrar produto; visitas à página de produto; cliques no WhatsApp. Eventos devem respeitar privacidade e consentimento quando aplicável. Não interpretar clique como venda.

## Critérios de sucesso
Administrador consegue publicar um produto com cor, tamanho, fotos e preço específico sem suporte técnico; visitante abre um link compartilhado, identifica variação existente e inicia contato correto no WhatsApp; nenhum catálogo acessa dados administrativos de outro.

## Premissas
Primeiro catálogo é infantil; segundo catálogo de brechó é cenário de evolução. Volume inicial aproximado: 100 produtos. Cadastro manual. Informações comerciais podem ser confirmadas no WhatsApp; disponibilidade não representa garantia de estoque.
