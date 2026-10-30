# Qualidade e testes

## Pirâmide de testes
- Unitários: preço base/override (inclusive zero), seleção de opções, disponibilidade, slug, mensagem WhatsApp.
- Integração: persistência transacional de variantes, constraints, regras de publicação, RLS e Storage.
- E2E: admin cadastra/publica; visitante navega, escolhe cor/tamanho e abre contato; admin de outro catálogo recebe acesso negado.

## Matriz mínima de casos
| Caso | Resultado esperado |
|---|---|
| Override nulo | Usa preço base |
| Override zero | Usa zero (se preço grátis permitido; política comercial pendente) |
| Cor sem foto específica | Usa foto geral |
| Tamanho muda, cor igual | Galeria não duplica fotos |
| Combinação inexistente | Não selecionável |
| Variação indisponível | CTA bloqueado/rotulado adequadamente |
| Todas indisponíveis | Produto publicado aparece como indisponível |
| Produto draft | Não acessível publicamente |
| Membro de outro catálogo | Não lê/edita conteúdo privado |
| Link WhatsApp | Texto codificado e dados da variante correta |

## Padrões de entrega
Typecheck, lint, testes automatizados, revisão de segurança, verificação mobile (360 px e desktop), estados loading/empty/error, imagens com alt, navegação por teclado, documentação atualizada.

## Operação
Configurar backup/restauração, gestão de secrets, alertas básicos, ambiente de staging e checklist de rollback de migrações antes do primeiro deploy de produção.
