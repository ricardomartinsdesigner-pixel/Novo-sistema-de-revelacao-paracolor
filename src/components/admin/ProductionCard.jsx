import { Link } from "@tanstack/react-router";
import { Loader2, MapPin, Printer, Store } from "lucide-react";
import { formatDate } from "@/lib/areas";
import { orderLabel } from "@/lib/order-paths";

export default function ProductionCard({ order, actionLabel, onAdvance, busy }) {
  const isDelivery = order.fulfillment === "entrega";

  return (
    <div className="card-glass p-3">
      <div className="flex items-start justify-between gap-2">
        <Link
          to="/admin/pedidos/$orderId"
          params={{ orderId: order.id }}
          className="inline-flex items-baseline gap-1.5 rounded-lg border border-gold/50 bg-gold-soft px-2.5 py-1 transition hover:border-gold hover:bg-accent"
          title="Abrir pedido"
        >
          <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-gold-deep/80">Nº</span>
          <span className="font-mono text-base font-semibold leading-none tracking-wide text-gold-deep">
            {orderLabel(order) || "—"}
          </span>
        </Link>
        <span className="mt-1 shrink-0 text-[10px] text-muted-foreground">{formatDate(order.created_date)}</span>
      </div>

      <p className="mt-0.5 truncate text-xs text-muted-foreground">{order.customer_name}</p>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Printer className="h-3 w-3" /> {order.prints} impressão(ões)
        </span>
        <span className="inline-flex items-center gap-1">
          {isDelivery ? <MapPin className="h-3 w-3" /> : <Store className="h-3 w-3" />}
          {isDelivery ? "Entrega" : "Retirada"}
        </span>
        {order.production_deadline_label || order.production_days ? <span>{order.production_deadline_label || `${order.production_days} dias úteis`}</span> : null}
      </div>

      <button
        type="button"
        onClick={() => onAdvance(order)}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs transition hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {actionLabel}
      </button>
    </div>
  );
}
