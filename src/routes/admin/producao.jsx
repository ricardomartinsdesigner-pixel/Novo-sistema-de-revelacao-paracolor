import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import ProductionCard from "@/components/admin/ProductionCard";
import OrderReleasePanel from "@/components/admin/OrderReleasePanel";
import { settleQuickDeadlines, updateOrderStatus } from "@/lib/store-fns";

export const Route = createFileRoute("/admin/producao")({
  head: () => ({ meta: [{ title: "Produção — Paracolor" }] }),
  component: ProductionPage,
});

const STAGES = [
  { key: "fila", title: "Fila", statuses: ["pagamento_aprovado", "arte_aprovada", "aguardando_producao"], next: "em_producao", action: "Iniciar produção" },
  { key: "producao", title: "Em produção", statuses: ["em_producao"], next: "aguardando_conferencia", action: "Ir para conferência" },
  { key: "conferencia", title: "Conferência", statuses: ["aguardando_conferencia"], next: "pronto", action: "Marcar pronto" },
  { key: "pronto", title: "Pronto", statuses: ["pronto"], next: "enviado", action: "Marcar entregue/retirado" },
];

const ALL_STATUSES = STAGES.flatMap((stage) => stage.statuses);

function ProductionPage() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");
  const advance = useServerFn(updateOrderStatus);
  const settle = useServerFn(settleQuickDeadlines);

  // Prazo encerrado = pedido pronto: confere ao abrir a fila e a cada minuto.
  useEffect(() => {
    let active = true;
    const run = () =>
      settle()
        .then((result) => {
          if (active && result?.settled) queryClient.invalidateQueries({ queryKey: ["admin-producao"] });
        })
        .catch(() => {});
    run();
    const timer = setInterval(run, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [settle, queryClient]);

  const { data: orders = [], isPending, error } = useQuery({
    queryKey: ["admin-producao"],
    queryFn: async () => {
      const page = await base44.entities.Order.filter(
        { status: { $in: ALL_STATUSES }, payment_status: "aprovado" },
        { sort: "created_date", limit: 120 }
      );
      const items = page.items ?? [];
      if (!items.length) return [];
      const aggregates = await base44.entities.OrderPhoto.aggregate({
        query: { order_id: { $in: items.map((order) => order.id) } },
        groupBy: "order_id",
        sum: ["copies"],
      }).catch(() => ({ rows: [] }));
      const prints = new Map((aggregates.rows ?? []).map((row) => [row.order_id, row.sum_copies || row.count || 0]));
      return items.map((order) => ({ ...order, prints: prints.get(order.id) || 0 }));
    },
  });

  const mutation = useMutation({
    mutationFn: (order) => advance({ data: { order_id: order.id, status: order.nextStatus } }),
    onMutate: (order) => setBusyId(order.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-producao"] }),
    onError: (mutationError) => toast.error(mutationError.message || "Não foi possível mudar o status."),
    onSettled: () => setBusyId(""),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) =>
      [order.internal_number, order.order_number].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [orders, search]);

  const columns = useMemo(
    () =>
      STAGES.map((stage) => ({
        ...stage,
        orders: filtered.filter((order) => stage.statuses.includes(order.status)),
      })),
    [filtered]
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Operação</p>
          <h1 className="mt-1 text-3xl">Produção</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Pedidos pagos na fila de impressão, do mais antigo para o mais novo.
          </p>
        </div>

        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Buscar por número do pedido</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar nº do pedido"
            className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-9 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
      </div>

      <OrderReleasePanel
        onReleased={() => queryClient.invalidateQueries({ queryKey: ["admin-producao"] })}
      />

      {error ? (
        <p className="mt-8 text-sm text-muted-foreground">Não foi possível carregar a fila de produção.</p>
      ) : search.trim() && !isPending && !filtered.length ? (
        <p className="mt-8 rounded-2xl border border-border bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
          Nenhum pedido em produção com o número “{search.trim()}”.
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
                {column.orders.map((order) => (
                  <ProductionCard
                    key={order.id}
                    order={order}
                    actionLabel={column.action}
                    busy={busyId === order.id}
                    onAdvance={(target) => mutation.mutate({ ...target, nextStatus: column.next })}
                  />
                ))}
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
    </div>
  );
}