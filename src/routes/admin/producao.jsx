import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { OrderQueueSearch, OrderQueueFooter, useOrderQueue } from "@/components/admin/OrderQueueControls";
import ProductionCard from "@/components/admin/ProductionCard";
import OrderReleasePanel from "@/components/admin/OrderReleasePanel";
import { updateOrderStatus } from "@/lib/store-fns";
import { needsArtApproval, PRODUCTION_START_STATUSES } from "@/lib/order-production";
import { awaitsPickupPayment } from "@/lib/order-payment";

export const Route = createFileRoute("/admin/producao")({
  head: () => ({ meta: [{ title: "Produção — Paracolor" }] }),
  component: ProductionPage,
});

const STAGES = [
  { key: "fila", title: "Prontos para iniciar", statuses: PRODUCTION_START_STATUSES, next: "em_producao", action: "Iniciar produção" },
  { key: "arte", title: "Aguardando aprovação da arte", statuses: PRODUCTION_START_STATUSES, next: "", action: "Aguardando aprovação da arte" },
  { key: "producao", title: "Em produção", statuses: ["em_producao"], next: "aguardando_conferencia", action: "Ir para conferência" },
  { key: "conferencia", title: "Conferência", statuses: ["aguardando_conferencia"], next: "pronto", action: "Marcar pronto" },
  { key: "pronto", title: "Pronto", statuses: ["pronto"], next: "", action: "Acompanhar em Entregas" },
];

function ProductionPage() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState("");
  const advance = useServerFn(updateOrderStatus);

  const queue = useOrderQueue("production", "admin-producao");
  const { orders, isPending, error, search } = queue;
  const mutation = useMutation({
    mutationFn: (order) => advance({ data: { order_id: order.id, status: order.nextStatus } }),
    onMutate: (order) => setBusyId(order.id),
    onSuccess: () => Promise.all(["admin-producao", "admin-entregas", "admin-new-orders", "admin-orders", "Order"].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
    onError: (mutationError) => toast.error(mutationError.message || "Não foi possível mudar o status."),
    onSettled: () => setBusyId(""),
  });

  const columns = useMemo(
    () =>
      STAGES.map((stage) => ({
        ...stage,
        orders: orders.filter((order) => stage.statuses.includes(order.status)
          && (stage.key === "arte" ? needsArtApproval(order) : stage.key !== "fila" || !needsArtApproval(order))),
      })),
    [orders]
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Operação</p>
          <h1 className="mt-1 text-3xl">Produção</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Acompanhe as aprovações e a fila de impressão, do pedido mais antigo para o mais novo.
          </p>
        </div>

        <OrderQueueSearch queue={queue} />
      </div>

      <OrderReleasePanel
        onReleased={() => queryClient.invalidateQueries({ queryKey: ["admin-producao"] })}
      />

      {error ? (
        <p className="mt-8 text-sm text-muted-foreground">Não foi possível carregar a fila de produção.</p>
      ) : search.trim() && !isPending && !orders.length ? (
        <p className="mt-8 rounded-2xl border border-border bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
          Nenhum pedido em produção para “{search.trim()}”.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => (
            <section key={column.key} className="rounded-2xl border border-border bg-secondary/40 p-3">
              <header className="flex items-center justify-between px-1">
                <h2 className="text-sm font-medium">{column.title}</h2>
                <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                  {column.orders.length}
                </span>
              </header>

              <div className="mt-3 space-y-2">
                {column.orders.map((order) => {
                  const readyForPickup = column.key === "pronto" && order.fulfillment === "retirada";
                  const pending = readyForPickup && awaitsPickupPayment(order);
                  const waitingArt = needsArtApproval(order);
                  return (
                    <ProductionCard
                      key={order.id}
                      order={order}
                      actionLabel={waitingArt ? "Aguardando aprovação da arte" : pending ? "Aguardando recebimento no balcão" : readyForPickup ? "Acompanhar em Entregas" : column.action}
                      busy={busyId === order.id}
                      disabled={waitingArt || pending || !column.next}
                      onAdvance={(target) => mutation.mutate({ ...target, nextStatus: column.next })}
                    />
                  );
                })}
                {!column.orders.length && (
                  <p className="px-1 py-6 text-center text-[11px] text-muted-foreground">
                    {isPending ? "Carregando…" : "Nada por aqui."}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
      <OrderQueueFooter queue={queue} />
    </div>
  );
}
