import { AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatBRL, formatDate } from "@/lib/areas";
import { useNewOrders } from "@/hooks/use-new-orders";

/** Alerta de pedidos recém-chegados na loja, exibido no topo da visão geral. */
export default function NewOrdersAlert() {
  const { orders, total } = useNewOrders();

  if (!total) return null;

  return (
    <section className="mt-6 overflow-hidden rounded-[var(--radius)] border-2 border-destructive/55 bg-destructive/10 elev-2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-destructive">
              {total === 1 ? "1 pedido pago para iniciar" : `${total} pedidos pagos para iniciar`}
            </p>
            <p className="text-[11px] font-medium text-foreground/70">
              Pagamento confirmado — confira os dados e dê início à produção.
            </p>
          </div>
        </div>

        <Link
          to="/admin/pedidos"
          className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3.5 py-2 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/90"
        >
          Ver pedidos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="divide-y divide-border/60 bg-card/80">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              to="/admin/pedidos/$orderId"
              params={{ orderId: order.id }}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 transition hover:bg-accent/60"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold text-foreground">{order.order_number}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {order.customer_name} · {formatDate(order.created_date)}
                </p>
              </div>
              <p className="font-semibold">{formatBRL(order.total)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}