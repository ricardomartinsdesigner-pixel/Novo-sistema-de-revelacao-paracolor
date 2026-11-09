import { useQuery } from "@tanstack/react-query";
import { getProductionStartOverview, getUnreadOrderAlerts } from "@/lib/admin-operations-fns";

const empty = { orders: [], total: 0 };

export function useNewOrders({ enabled = true } = {}) {
  const { data } = useQuery({
    queryKey: ["admin-new-orders"],
    queryFn: () => getProductionStartOverview(),
    refetchInterval: 30_000,
    enabled,
  });
  const { data: unreadData } = useQuery({
    queryKey: ["admin-unread-order-alerts"],
    queryFn: () => getUnreadOrderAlerts(),
    refetchInterval: 30_000,
    enabled,
  });
  return {
    ready: data?.ready ?? empty,
    waiting: data?.waiting ?? empty,
    unread: unreadData ?? { items: [], total: 0 },
  };
}
