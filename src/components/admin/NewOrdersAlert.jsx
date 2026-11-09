import { AlertTriangle, ArrowRight, BellRing, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatBRL, formatDate } from "@/lib/areas";
import { useNewOrders } from "@/hooks/use-new-orders";

export default function NewOrdersAlert() {
  const { ready, waiting, unread } = useNewOrders();
  return <>
    <UnreadOrderGroup alerts={unread} />
    <OrderStartGroup group={ready} />
    <OrderStartGroup group={waiting} waiting />
  </>;
}

function UnreadOrderGroup({ alerts: { items, total } }) {
  if (!total) return null;
  return (
    <section className="mt-6 overflow-hidden rounded-[var(--radius)] border-2 border-destructive/55 bg-destructive/10 elev-2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground">
            <BellRing className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide">
              {total} {total === 1 ? "pedido novo para abrir" : "pedidos novos para abrir"}
            </p>
            <p className="text-[11px] font-medium text-foreground/70">O aviso some desta lista quando você abrir o pedido. Ele continua na fila normal de pedidos.</p>
          </div>
        </div>
        <Link to="/admin/pedidos" className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3.5 py-2 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/90">
          Ver pedidos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul className="divide-y divide-border/60 bg-card/80">
        {items.map((order) => (
          <li key={order.id}>
            <Link to="/admin/pedidos/$orderId" params={{ orderId: order.id }} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 transition hover:bg-accent/60">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold text-foreground">{order.internal_number || order.order_number}</p>
                {(() => {
                  const paymentLabel = order.payment_status === "aprovado"
                    ? "pagamento aprovado"
                    : order.payment_method === "pagar_na_retirada" ? "pagamento na retirada" : "pagamento pendente";
                  const professional = order.customer_professional === "true" ? "Fotógrafo profissional · " : "";
                  return <p className="text-[11px] text-muted-foreground">{order.customer_name} · {formatDate(order.created_date)} · {professional}{paymentLabel}</p>;
                })()}
              </div>
              <p className="font-semibold">{formatBRL(order.total)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OrderStartGroup({ group: { orders, total }, waiting = false }) {
  const Icon = waiting ? Clock : AlertTriangle;
  const title = waiting
    ? `${total} ${total === 1 ? "pedido" : "pedidos"} aguardando aprovação da arte`
    : `${total} ${total === 1 ? "pedido pronto" : "pedidos prontos"} para iniciar`;

  if (!total) return null;

  return (
    <section className={waiting ? "mt-4 overflow-hidden rounded-[var(--radius)] border border-gold/50 bg-gold-soft" : "mt-6 overflow-hidden rounded-[var(--radius)] border-2 border-destructive/55 bg-destructive/10 elev-2"}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={waiting ? "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-gold-foreground" : "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground"}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide">
              {title}
            </p>
            <p className="text-[11px] font-medium text-foreground/70">
              {waiting ? "Confira a arte no pedido e registre a aprovação para liberar a produção." : "Confira os dados do pedido e inicie a produção."}
            </p>
          </div>
        </div>

        <Link
          to="/admin/producao"
          className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3.5 py-2 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/90"
        >
          Ver produção <ArrowRight className="h-3.5 w-3.5" />
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
                <p className="font-mono text-sm font-semibold text-foreground">{order.internal_number || order.order_number}</p>
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
