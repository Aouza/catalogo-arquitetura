# Segurança, autorização e isolamento

Modelo de loja única (ADR-004): a distinção é entre público, usuário autenticado sem papel e administrador.

## Modelo de ameaças
Visitante só acessa dados publicados. Usuário anônimo ou autenticado sem papel de admin não pode modificar registros nem ler rascunhos e imagens privadas. Upload malicioso ou excessivo não pode comprometer serviço/custos.

## Requisitos
1. Supabase Auth (e-mail e senha) para administradores; sessão verificada no servidor com `getUser()`, nunca confiando em `getSession()` ou em cookies sem validação.
2. RLS habilitada em todas as tabelas de domínio; políticas de leitura pública restritas ao conteúdo publicado (BR-011).
3. Políticas de escrita exigem `is_admin()`; não há cadastro público de administradores.
4. Evitar políticas recursivas em `admins`; `is_admin()` é `SECURITY DEFINER` com `search_path` fixo e `EXECUTE` revogado de `PUBLIC`.
5. Storage: upload apenas por admin; limites de tamanho, MIME e extensão; nomes aleatórios; não confiar apenas no MIME enviado.
6. Fotos ficam em bucket privado (`product-images`). O público só lê o arquivo de uma foto cadastrada de produto publicado; rascunhos, arquivados e arquivos sem foto cadastrada (órfãos) são visíveis só ao admin (OQ-04). O admin pré-visualiza por URLs assinadas temporárias.
7. Service role nunca no browser e nunca para contornar autorização de requisições comuns.
8. Login com mensagem de erro genérica (sem revelar se o e-mail existe); limitar operações sensíveis, validar payload com Zod e sanitizar entrada textual.
9. A checagem de admin no servidor (`requireAdmin`) é a autorização; redirecionamento em proxy/middleware é apenas conveniência.
10. Logs sem tokens, segredos ou informações privadas; gestão de secrets via ambiente.
11. Revisar políticas com testes de anônimo, autenticado sem papel e admin.

## Casos de teste obrigatórios
Anônimo não altera dados; autenticado não-admin não altera dados; admin altera; anônimo não lê `admins`; segunda linha de `store_settings` é rejeitada; upload por não-admin falha; imagem de rascunho não vaza conforme estratégia escolhida; publicação expõe apenas campos esperados.
