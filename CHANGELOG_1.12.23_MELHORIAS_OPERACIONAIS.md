# Paracolor 1.12.23

## Alterações

- Consultas de listagem e contagem agora filtram, ordenam e paginam no PostgreSQL, em vez de carregar todos os registros correspondentes para filtrar na aplicação.
- Consultas respeitam permissões de leitura e aceitam filtros parametrizados. Expressões regulares arbitrárias são recusadas para evitar buscas sem limite previsível.
- Backup e restauração incluem as tabelas do painel de visitas e presença on-line.
- `/api/data` e upload usam a mesma validação de origem compatível com proxy reverso usada pelas outras rotas.
- Registros de analytics recebem limite de frequência por endereço e validação curta do corpo da requisição.
- O histórico de analytics tem retenção configurável por `ANALYTICS_RETENTION_DAYS` (padrão 400 dias, mínimo 90, máximo 730), e o painel informa o período exibido. Presenças antigas são removidas durante a limpeza periódica.
- Envios em celulares e aparelhos com menos recursos processam até duas fotos simultaneamente para reduzir pressão de memória; em computadores com mais recursos permanecem quatro workers.
- A página de revelação identifica claramente o valor da foto 3×4 como preço por folha com 12 fotos e informa o tamanho montado.
- O editor de revelação mostra a prévia final da folha 3×4 montada com o enquadramento selecionado antes de adicionar ao carrinho.
- A política de privacidade explica o identificador aleatório de analytics e o prazo padrão de retenção.
- Corrigido um problema de lint no gerador de arquivos de ímãs.

## Verificação

- `npm test`: 75 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado.
