import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/** Pedidos pagos que ainda não entraram em produção. */
export const NEW_ORDER_STATUSES = [
  "pagamento_aprovado",
  "aguardando_arte",
  "aguardando_aprovacao",
  "ajustes_solicitados",
  "arte_aprovada",
];

export function useNewOrders(limit = 5) {
  const query = { payment_status: "aprovado", status: { $in: NEW_ORDER_STATUSES } };
  const { data } = useQuery({
    queryKey: ["admin-new-orders", limit],
    queryFn: async () => {
      const [page, total] = await Promise.all([
        base44.entities.Order.filter(query, { sort: "-created_date", limit }),
        base44.entities.Order.count(query),
      ]);
      return { orders: page.items ?? [], total };
    },
    refetchInterval: 30000,
  });
  return { orders: data?.orders ?? [], total: data?.total ?? 0 };
}