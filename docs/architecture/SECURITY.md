# Segurança, autorização e isolamento

## Modelo de ameaças
Administrador A não pode ler/alterar rascunhos, imagens privadas ou produtos do catálogo B. Visitante só acessa dados publicados. Usuário anônimo não pode modificar registros. Upload malicioso ou excessivo não pode comprometer serviço/custos.

## Requisitos
1. Supabase Auth para administradores; sessões verificadas no servidor.
2. RLS habilitada em todas as tabelas de domínio; políticas de leitura pública restritas a catálogos/produtos publicados conforme regra de visibilidade.
3. Políticas de escrita vinculadas a `catalog_members` e papéis autorizados.
4. Evitar políticas recursivas em `catalog_members`; usar função SECURITY DEFINER cuidadosamente revisada quando necessário.
5. Storage: upload apenas para prefixo de catálogo autorizado; limites de tamanho, MIME e extensão; nomes aleatórios; não confiar apenas no MIME enviado.
6. Fotos de produtos publicados podem ser servidas publicamente; uploads temporários/rascunhos exigem estratégia explícita (bucket privado + URLs assinadas ou fluxo de publicação). **Decisão pendente.**
7. Service role nunca no browser e nunca para contornar autorização de requisições comuns.
8. Limitar operações sensíveis, validar payload com Zod e sanitizar entrada textual.
9. Logs sem tokens, segredos ou informações privadas; gestão de secrets via ambiente.
10. Revisar políticas com testes de dois catálogos e usuário anônimo.

## Casos de teste obrigatórios
Anônimo não altera dados; admin A não lê rascunho de B; admin A não edita produto de B; associação de categoria de B a produto de A falha; upload em prefixo de B falha; imagem de rascunho não vaza conforme estratégia escolhida; publicação expõe apenas campos esperados.
