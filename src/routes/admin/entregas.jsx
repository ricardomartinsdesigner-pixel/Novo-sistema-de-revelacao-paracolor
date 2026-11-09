import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Store } from "lucide-react";
import { toast } from "sonner";
import { OrderQueueSearch, OrderQueueFooter, useOrderQueue } from "@/components/admin/OrderQueueControls";
import { updateOrderStatus } from "@/lib/store-fns";
import { orderLabel } from "@/lib/order-paths";
import MelhorEnvioConfig from "@/components/admin/MelhorEnvioConfig";
import OrderCustomerBadges from "@/components/admin/OrderCustomerBadges";
import { formatBRL, formatDate } from "@/lib/areas";
import { awaitsPickupPayment } from "@/lib/order-payment";

export const Route = createFileRoute("/admin/entregas")({
  head: () => ({ meta: [{ title: "Entregas — Paracolor" }] }),
  component: DeliveriesPage,
});

function DeliveryCard({ order, actionLabel, busy, onAction }) {
  const delivery = order.fulfillment === "entrega";
  return (
    <div className="card-glass p-3">
      <div className="flex items-start justify-between gap-2">
        <Link to="/admin/pedidos/$orderId" params={{ orderId: order.id }} className="text-sm font-medium hover:text-primary">
          {orderLabel(order)}
        </Link>
        <span className="text-[11px] text-muted-foreground">{formatDate(order.created_date)}</span>
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{order.customer_name}</p>
      <OrderCustomerBadges order={order} />
      {awaitsPickupPayment(order) && <p className="mt-2 text-sm font-semibold">{formatBRL(order.total)} a receber</p>}
      <p className="mt-2 flex items-start gap-1 text-[11px] text-muted-foreground">
        {delivery ? <MapPin className="mt-0.5 h-3 w-3 flex-none" /> : <Store className="mt-0.5 h-3 w-3 flex-none" />}
        {delivery ? order.shipping_address || `CEP ${order.shipping_cep || "não informado"}` : "Retirada na loja"}
      </p>
      <button
        type="button"
        onClick={() => onAction(order)}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gold px-2 py-1.5 text-xs text-gold-deep transition hover:bg-gold-soft disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {actionLabel}
      </button>
    </div>
  );
}

function DeliveriesPage() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState("");
  const advance = useServerFn(updateOrderStatus);

  const queue = useOrderQueue("deliveries", "admin-entregas");
  const { orders, isPending } = queue;

  const mutation = useMutation({
    mutationFn: ({ order, status }) => advance({ data: { order_id: order.id, status } }),
    onMutate: ({ order }) => setBusyId(order.id),
    onSuccess: (_, { order, status }) => {
      if (status === "pagamento_aprovado") toast.success("Recebimento confirmado. A retirada pode ser registrada.");
      return Promise.all([
        ["admin-entregas"], ["admin-producao"], ["admin-payments"], ["admin-payments-pending"], ["Order"], ["admin-order", order.id],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: (error) => toast.error(error.message || "Não foi possível atualizar o pedido."),
    onSettled: () => setBusyId(""),
  });

  const toShip = orders.filter((order) => order.fulfillment === "entrega" && order.status !== "enviado");
  const toPickup = orders.filter((order) => order.fulfillment !== "entrega" && !["retirado", "enviado", "concluido"].includes(order.status));
  const inTransit = orders.filter((order) => order.status === "enviado");

  const columns = [
    { key: "ship", title: "Para enviar", list: toShip, label: "Marcar enviado", status: "enviado" },
    { key: "pickup", title: "Para retirar", list: toPickup, label: "Marcar retirado", status: "retirado" },
    { key: "transit", title: "Em trânsito", list: inTransit, label: "Concluir pedido", status: "concluido" },
  ];

  return (
    <div>
      <p className="eyebrow">Operação</p>
      <h1 className="mt-1 text-3xl">Entregas</h1>
      <p className="mt-1 text-xs text-muted-foreground">Envios e retiradas. Confira os valores a receber no balcão antes de dar baixa.</p>

      <OrderQueueSearch queue={queue} />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {columns.map((column) => (
          <section key={column.key} className="rounded-2xl border border-border bg-secondary/40 p-3">
            <header className="flex items-center justify-between px-1">
              <h2 className="text-sm font-medium">{column.title}</h2>
              <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted-foreground">{column.list.length}</span>
            </header>
            <div className="mt-3 space-y-2">
              {column.list.map((order) => (
                <DeliveryCard
                  key={order.id}
                  order={order}
                  actionLabel={awaitsPickupPayment(order) ? "Confirmar recebimento" : column.label}
                  busy={busyId === order.id}
                  onAction={(target) => mutation.mutate({
                    order: target, status: awaitsPickupPayment(target) ? "pagamento_aprovado" : column.status,
                  })}
                />
              ))}
              {!column.list.length && (
                <p className="px-1 py-6 text-center text-[11px] text-muted-foreground">{isPending ? "Carregando…" : "Nada por aqui."}</p>
              )}
            </div>
          </section>
        ))}
      </div>
      <OrderQueueFooter queue={queue} />
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium">Configuração do Melhor Envio</summary>
        <MelhorEnvioConfig />
      </details>
    </div>
  );
}
