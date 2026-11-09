import { canProduceOrder } from "./order-payment.js";

const ART_STAGES = new Set(["aguardando_arte", "aguardando_aprovacao", "ajustes_solicitados", "arte_aprovada"]);
const OPERATION_STAGES = new Set(["em_producao", "aguardando_conferencia", "pronto", "retirado", "enviado", "concluido", "cancelado"]);

export function orderStatusAfterArtApproval(order) {
  if (!ART_STAGES.has(order.status)) return order.status;
  // Pedidos de versões anteriores podem estar em uma etapa de arte que substituiu a etapa real.
  const previous = (Array.isArray(order.status_history) ? order.status_history : [])
    .findLast((entry) => entry?.status && !ART_STAGES.has(entry.status));
  if (OPERATION_STAGES.has(previous?.status)) return previous.status;
  return canProduceOrder(order) ? "aguardando_producao" : "aguardando_pagamento";
}
