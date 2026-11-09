const PUBLIC_EVENTS = new Set([
  "aguardando_pagamento", "pagamento_aprovado", "aguardando_aprovacao", "em_producao", "pronto", "retirado", "enviado", "concluido", "cancelado",
]);

export function publicOrderHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.filter((entry) => PUBLIC_EVENTS.has(entry?.status) && typeof entry.date === "string" && Number.isFinite(Date.parse(entry.date)))
    .slice(-8).map(({ status, date }) => ({ status, date }));
}

export function nextOrderStep(order) {
  if (order.status === "cancelado") return "Se precisar de ajuda com este cancelamento, fale com a loja.";
  if (order.payment_status === "reembolsado") return "O reembolso foi registrado. Fale com a loja se precisar de ajuda.";
  if (order.status === "retirado") return "A retirada do seu pedido foi registrada. Obrigado!";
  if (order.status === "concluido") return "Pedido entregue.";
  if (order.status === "enviado") return "Seu pedido foi enviado. Aguarde a entrega.";
  if (order.status === "pronto") {
    if (order.fulfillment === "entrega") return "Seu pedido está pronto. Aguarde o envio.";
    if (order.payment_status === "pendente" && order.payment_method === "pagar_na_retirada") return "Seu pedido está pronto. Pague no balcão ao retirar.";
    return "Seu pedido está pronto para retirar na loja.";
  }
  if (order.payment_status === "pendente" && order.payment_method !== "pagar_na_retirada") {
    return order.payment_method === "retirada" ? "Combine o pagamento com a loja." : "Conclua o pagamento para liberar o pedido.";
  }
  if ((order.art_approval_status === "aguardando" && order.art_approval_requested) || (!order.art_approval_status && order.status === "aguardando_aprovacao")) return "Confira a arte e envie sua aprovação pelo canal indicado no pedido.";
  if (order.art_approval_status === "ajustes" || (!order.art_approval_status && order.status === "ajustes_solicitados")) return "A loja recebeu seus ajustes. Aguarde a nova versão da arte.";
  return "Aguarde a próxima atualização da loja.";
}
