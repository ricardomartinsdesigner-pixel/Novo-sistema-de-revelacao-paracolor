import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, MapPin, Pencil, Phone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import ClientEditDialog from "@/components/admin/ClientEditDialog";
import OrderCustomerBadges from "@/components/admin/OrderCustomerBadges";
import OrderCountdown from "@/components/orders/OrderCountdown";
import { STATUS_LABELS, formatBRL, formatDate } from "@/lib/areas";
import { orderLabel } from "@/lib/order-paths";
import { toArray } from "@/lib/collection-utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/order-payment";

export default function OrderHeaderCard({ order }) {
  const [editing, setEditing] = useState(false);
  const { data: client } = useQuery({
    queryKey: ["admin-order-client", order.customer_user_id || order.customer_email],
    enabled: Boolean(order.customer_user_id || order.customer_email),
    queryFn: async () => {
      if (order.customer_user_id) return base44.entities.User.get(order.customer_user_id);
      return toArray(await base44.entities.User.filter({ email: order.customer_email }, { limit: 1 }))[0] ?? null;
    },
  });

  const address = client?.address || order.shipping_address;
  const inProduction = order.status === "em_producao" && Boolean(order.quick_due_at);

  return (
    <section className="ink-panel elev-3 rounded-[var(--radius)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-gold-bright">Cliente</p>
          <h2 className="mt-1 text-3xl leading-tight">{order.customer_name}</h2>
          <OrderCustomerBadges order={order} profileProfessional={client?.professional_pricing === true} />
          <p className="mt-2 flex items-center gap-2 text-sm font-medium">
            <Phone className="h-3.5 w-3.5 text-gold-bright" />
            {order.customer_phone || "telefone não informado"}
          </p>
          <p className="mt-1 flex items-start gap-2 text-sm opacity-75">
            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-none text-gold-bright" />
            <span>{address || "endereço não informado"}</span>
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs opacity-60">
            <Mail className="h-3.5 w-3.5 flex-none text-gold-bright" />
            {order.customer_email}
          </p>
          {client ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="mt-3 gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Editar cadastro
            </Button>
          ) : null}
        </div>

        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.24em] opacity-60">{orderLabel(order)}</p>
          <p className="mt-1 inline-flex rounded-full border border-gold-bright/40 px-3 py-1 text-xs">
            {STATUS_LABELS[order.status] || order.status}
          </p>
          {inProduction ? (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-[0.18em] opacity-60">Prazo de {order.quick_label || "produção"}</p>
              <OrderCountdown dueAt={order.quick_due_at} className="mt-1 block text-2xl font-medium text-gold-bright" />
            </div>
          ) : null}
        </div>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-gold-bright/20 pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.18em] opacity-60">Pagamento</dt>
          <dd className="mt-0.5">{order.payment_status} · {PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.18em] opacity-60">Recebimento</dt>
          <dd className="mt-0.5">{order.fulfillment === "entrega" ? "Entrega" : "Retirada na loja"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.18em] opacity-60">Total</dt>
          <dd className="mt-0.5">{formatBRL(order.total)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.18em] opacity-60">Pedido em</dt>
          <dd className="mt-0.5">{formatDate(order.created_date)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.18em] opacity-60">Responsável</dt>
          <dd className="mt-0.5">{order.last_action_by || "—"}</dd>
          {order.last_action_at ? <dd className="text-[11px] opacity-60">{formatDate(order.last_action_at)}</dd> : null}
        </div>
      </dl>

      {client ? <ClientEditDialog client={client} open={editing} onOpenChange={setEditing} /> : null}
    </section>
  );
}
