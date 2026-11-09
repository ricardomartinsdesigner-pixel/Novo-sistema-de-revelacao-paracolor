export const ART_PENDING_STATUSES = ["aguardando_arte", "aguardando_aprovacao", "ajustes_solicitados"];
export const PRODUCTION_START_STATUSES = [
  "pagamento_aprovado", ...ART_PENDING_STATUSES, "arte_aprovada", "aguardando_producao",
];

export function needsArtApproval(order) {
  return order.art_approval_status !== "aprovada"
    && (String(order.art_approval_requested) === "true" || ART_PENDING_STATUSES.includes(order.status));
}
