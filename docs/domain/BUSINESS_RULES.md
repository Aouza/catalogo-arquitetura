# Regras de negócio (identificadores estáveis)

## Catálogos e acesso
- **BR-001** Produto, categoria e opções pertencem a um catálogo por meio do produto ou diretamente.
- **BR-002** Apenas membros autorizados podem administrar catálogo; isolamento é obrigatório inclusive em consultas e Storage.
- **BR-003** Cada catálogo possui slug único globalmente na proposta inicial.
- **BR-004** O WhatsApp de contato é configurado por catálogo, não por produto no MVP.

## Produto
- **BR-010** Estados de publicação: `draft`, `published`, `archived`.
- **BR-011** Somente `published` é elegível à vitrine pública.
- **BR-012** Arquivar não apaga o histórico nem arquivos automaticamente.
- **BR-013** Produto possui preço base em centavos BRL, não negativo.
- **BR-014** Produto simples pode ter uma variação padrão sem opções visíveis.

## Opções e variações
- **BR-020** Tipos de opção são configuráveis por produto; interface prioriza `color` e `size`.
- **BR-021** Cada variação representa exatamente uma combinação válida dos valores exigidos pelas opções do produto.
- **BR-022** Não permitir duas variações com a mesma combinação no mesmo produto (validar transacionalmente).
- **BR-023** `is_available` é booleano por variação; não existe quantidade no MVP.
- **BR-024** Preço efetivo = `price_override_cents ?? base_price_cents`; zero é diferente de `null`.
- **BR-025** Opções/valores associados a uma variação devem pertencer ao mesmo produto.
- **BR-026** Não oferecer CTA de interesse como disponível para variação indisponível.
- **BR-027** Se nenhuma variação estiver disponível, o produto pode continuar publicado com indicação de indisponibilidade.
- **BR-028** Gerar combinações no admin não significa publicar todas; administrador revisa e confirma combinações válidas.

## Imagens
- **BR-030** Imagens gerais pertencem ao produto; imagens específicas podem apontar para um valor de opção do mesmo produto.
- **BR-031** Seleção de cor mostra primeiro imagens associadas àquela cor; usar imagens gerais como fallback.
- **BR-032** Alterar tamanho não exige duplicação de imagens.
- **BR-033** Ordenação de imagens é persistida; ao excluir imagem, remover referência e limpar arquivo conforme política segura.

## Contato
- **BR-040** Mensagem WhatsApp contém produto, valores selecionados, preço efetivo exibido e URL canônica.
- **BR-041** Mensagem só é montada com combinação válida; preço/disponibilidade são informativos e sujeitos à confirmação pelo vendedor.
- **BR-042** Não criar pedido, reserva ou pagamento ao clicar no WhatsApp.

## Integridade
- **BR-050** Nunca confiar em valores monetários, associação de catálogo ou disponibilidade enviados sem validação no servidor.
- **BR-051** Slugs de produto são únicos dentro do catálogo, não necessariamente globalmente.
- **BR-052** Importação futura deve reutilizar os mesmos casos de uso e validações do cadastro manual.
