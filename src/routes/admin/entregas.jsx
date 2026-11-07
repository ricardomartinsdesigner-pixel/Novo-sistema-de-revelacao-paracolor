import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Store } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { updateOrderStatus } from "@/lib/store-fns";
import { orderLabel } from "@/lib/order-paths";
import MelhorEnvioConfig from "@/components/admin/MelhorEnvioConfig";
import { formatDate } from "@/lib/areas";

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

  const { data: orders = [], isPending } = useQuery({
    queryKey: ["admin-entregas"],
    queryFn: async () =>
      (await base44.entities.Order.filter(
        { payment_status: "aprovado", status: { $in: ["aguardando_conferencia", "pronto", "enviado"] } },
        { sort: "created_date", limit: 120 }
      )).items ?? [],
  });

  const mutation = useMutation({
    mutationFn: ({ order, status }) => advance({ data: { order_id: order.id, status } }),
    onMutate: ({ order }) => setBusyId(order.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-entregas"] }),
    onError: (error) => toast.error(error.message || "Não foi possível atualizar o pedido."),
    onSettled: () => setBusyId(""),
  });

  const toShip = orders.filter((order) => order.fulfillment === "entrega" && order.status !== "enviado");
  const toPickup = orders.filter((order) => order.fulfillment !== "entrega" && order.status !== "enviado");
  const inTransit = orders.filter((order) => order.status === "enviado");

  const columns = [
    { key: "ship", title: "Para enviar", list: toShip, label: "Marcar enviado", status: "enviado" },
    { key: "pickup", title: "Para retirar", list: toPickup, label: "Marcar retirado", status: "concluido" },
    { key: "transit", title: "Saiu / retirado", list: inTransit, label: "Concluir pedido", status: "concluido" },
  ];

  return (
    <div>
      <p className="eyebrow">Operação</p>
      <h1 className="mt-1 text-3xl">Entregas</h1>
      <p className="mt-1 text-xs text-muted-foreground">Pedidos pagos prontos para envio, retirada ou já em trânsito.</p>

      <div className="mt-5">
        <MelhorEnvioConfig />
      </div>

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
                  actionLabel={column.label}
                  busy={busyId === order.id}
                  onAction={(target) => mutation.mutate({ order: target, status: column.status })}
                />
              ))}
              {!column.list.length && (
                <p className="px-1 py-6 text-center text-[11px] text-muted-foreground">{isPending ? "Carregando…" : "Nada por aqui."}</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}