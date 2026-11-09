import { z } from "zod";
import { STATUS_FLOW } from "./areas.js";

export const ORDER_TABS = {
  iniciar: {
    label: "Para iniciar",
    statuses: ["aguardando_pagamento", "pagamento_aprovado", "aguardando_arte", "aguardando_aprovacao", "ajustes_solicitados", "arte_aprovada", "aguardando_producao"],
  },
  andamento: { label: "Em andamento", statuses: ["em_producao", "aguardando_conferencia"] },
  concluidos: { label: "Concluídos", statuses: ["pronto"] },
  enviado: { label: "Enviados", statuses: ["enviado"] },
  retirado: { label: "Retirados / entregues", statuses: ["retirado", "concluido"] },
  cancelado: { label: "Cancelados", statuses: ["cancelado"] },
};

export const OrderFilters = z.object({
  view: z.enum(Object.keys(ORDER_TABS)).default("iniciar"),
  status: z.enum(["todos", ...STATUS_FLOW]).default("todos"),
  payment: z.enum(["todos", "pendente", "aprovado", "recusado", "reembolsado", "teste_aprovado"]).default("todos"),
  search: z.string().trim().max(160).default(""),
});

export function orderStatuses(filters) {
  if (filters.status !== "todos") return [filters.status];
  return filters.search ? [] : ORDER_TABS[filters.view].statuses;
}

export function prioritizeDeadline(filters) {
  return filters.view === "andamento" && !filters.search && (filters.status === "todos" || ORDER_TABS.andamento.statuses.includes(filters.status));
}
