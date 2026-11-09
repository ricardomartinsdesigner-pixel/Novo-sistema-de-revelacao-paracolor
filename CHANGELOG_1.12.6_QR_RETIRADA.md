# Paracolor 1.12.6 — QR Code de retirada

- Exibe QR Code de retirada na área de detalhes do pedido do cliente quando o pedido está pronto.
- Permite que a equipe leia o código pela câmera do celular e abra a página protegida de baixa.
- Registra a retirada como status `retirado`, com data, responsável e histórico.
- Inclui modos configuráveis no painel: baixa automática, confirmação manual ou somente consulta.
- Bloqueia a baixa por QR se o pedido não estiver pronto para retirada ou com aprovação de arte pendente; pagamentos no balcão podem ser confirmados pela equipe junto com a retirada. Pagamentos online continuam exigindo confirmação do provedor.
- Permite desfazer a baixa pelo mesmo funcionário durante dois minutos.
- Separa pedidos retirados de entregas concluídas e mantém a busca de pedidos por QR autenticada.
