import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Eye, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import OrderCustomerBadges from "@/components/admin/OrderCustomerBadges";
import { STATUS_LABELS, STATUS_FLOW, formatBRL, formatDate } from "@/lib/areas";
import { getAdminOrders, getAdminOrderTabCounts } from "@/lib/admin-operations-fns";
import { ORDER_TABS, prioritizeDeadline } from "@/lib/admin-order-filters";
import { toast } from "sonner";
import { toArray } from "@/lib/collection-utils";

export const Route = createFileRoute("/admin/pedidos/")({
  head: () => ({ meta: [{ title: "Pedidos — Paracolor" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("iniciar");
  const [status, setStatus] = useState("todos");
  const [payment, setPayment] = useState("todos");
  const [exporting, setExporting] = useState(false);
  const queryClient = useQueryClient();

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350); return () => clearTimeout(timer); }, [search]);
  const filters = useMemo(() => ({ view, status, payment, search: debouncedSearch }), [view, status, payment, debouncedSearch]);
  const showDeadline = prioritizeDeadline(filters);
  const { data, isPending, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = useInfiniteQuery({
    queryKey: ["Order", "admin-pages", filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getAdminOrders({ data: { filters, offset: pageParam } }),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
    staleTime: 30_000,
  });
  const filtered = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  useEffect(() => base44.entities.Order.subscribe(() => queryClient.invalidateQueries({ queryKey: ["Order"] })), [queryClient]);
  const profileIds = [...new Set(filtered
    .filter((order) => order.customer_professional !== true)
    .map((order) => order.customer_user_id)
    .filter(Boolean))].sort();
  const { data: professionalIds = [] } = useQuery({
    queryKey: ["admin-users", "order-professionals", profileIds],
    enabled: profileIds.length > 0,
    queryFn: async () => toArray(await base44.entities.User.filter({
      id: { $in: profileIds }, professional_pricing: true,
    }, { limit: profileIds.length })).map((profile) => profile.id),
  });
  const currentProfessionals = new Set(professionalIds);
  const { data: tabCounts = {} } = useQuery({
    queryKey: ["Order", "tab-counts"],
    queryFn: () => getAdminOrderTabCounts(),
  });

  async function exportCsv() {
    setExporting(true);
    try {
      const response = await fetch("/api/admin/orders-export", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(filters),
      });
      if (!response.ok) throw new Error("Não foi possível exportar os pedidos.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "pedidos_paracolor.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Não foi possível exportar os pedidos. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Operação</p>
          <h1 className="mt-1 text-3xl">Pedidos</h1>
          <p className="mt-1 text-xs text-muted-foreground">{filtered.length} carregados · {total} pedidos encontrados</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting || isPending || search.trim() !== debouncedSearch} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> {exporting ? "Exportando…" : "Exportar pedidos filtrados"}
        </Button>
      </div>

      <div className={`mt-5 flex-wrap items-center gap-1 rounded-lg border border-border p-1 text-xs ${debouncedSearch ? "hidden" : "inline-flex"}`}>
        {Object.entries(ORDER_TABS).map(([key, tab]) => (
          <button
            key={key}
            onClick={() => { setView(key); setStatus("todos"); }}
            aria-pressed={view === key}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
              view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {tab.label}
            {tabCounts[key] ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  key === "iniciar"
                    ? "bg-destructive text-destructive-foreground"
                    : view === key
                      ? "bg-primary-foreground/20"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {tabCounts[key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {debouncedSearch ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          Buscando em todos os pedidos por nome, telefone, CPF, e-mail ou número — inclusive os concluídos.
        </p>
      ) : view === "iniciar" ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Pedidos que ainda não entraram em produção — abra o pedido e use “Liberar para produção”.
        </p>
      ) : showDeadline ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Pedidos em produção ou conferência, com os prazos definidos mais próximos primeiro.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={search}
          maxLength={160}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, telefone, CPF, e-mail ou número do pedido"
          className="min-w-[220px] flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
          <option value="todos">Todos os status</option>
          {STATUS_FLOW.map((value) => (
            <option key={value} value={value}>{STATUS_LABELS[value]}</option>
          ))}
        </select>
        <select value={payment} onChange={(event) => setPayment(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
          <option value="todos">Pagamento</option>
          <option value="pendente">Pendente</option>
          <option value="aprovado">Aprovado</option>
          <option value="recusado">Recusado</option>
          <option value="reembolsado">Reembolsado</option>
          <option value="teste_aprovado">Teste aprovado</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Pedido</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Pagamento</th>
              <th className="px-3 py-2">Responsável</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Abrir</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-t border-border hover:bg-secondary/30">
                <td className="px-3 py-2">
                  <Link to="/admin/pedidos/$orderId" params={{ orderId: order.id }} className="font-medium hover:text-primary">
                    {order.order_number}
                  </Link>
                  {order.internal_number ? (
                    <span className="block text-[11px] text-muted-foreground">interna: {order.internal_number}</span>
                  ) : null}
                  {order.has_order_alert ? (() => {
                    const viewers = Array.isArray(order.alert_viewers) ? order.alert_viewers : [];
                    const viewedAt = order.alert_viewed_at
                      ? new Date(order.alert_viewed_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                      : "";
                    const label = viewedAt
                      ? `Visualizado por você · ${viewedAt}`
                      : viewers.length
                        ? `Você ainda não abriu · visto por ${viewers.map((viewer) => viewer.name).filter(Boolean).join(", ")}`
                        : order.alert_is_legacy
                          ? "Alerta anterior à atualização · abra para registrar a visualização"
                          : "Novo · não visualizado";
                    return <span className={`mt-1 block text-[10px] font-medium ${viewedAt ? "text-muted-foreground" : "text-destructive"}`}>{label}</span>;
                  })() : null}
                </td>
                <td className="px-3 py-2">
                  {order.customer_name}
                  <OrderCustomerBadges order={order} profileProfessional={currentProfessionals.has(order.customer_user_id)} />
                  <span className="block text-[11px] text-muted-foreground">{order.customer_email}</span>
                  {order.customer_cpf ? (
                    <span className="block text-[11px] text-muted-foreground">CPF {order.customer_cpf}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(order.created_date)}
                  {showDeadline && order.quick_due_at && <span className="block font-medium text-foreground">Prazo {formatDate(order.quick_due_at)}</span>}
                </td>
                <td className="px-3 py-2 text-xs">{STATUS_LABELS[order.status] || order.status}</td>
                <td className="px-3 py-2 text-xs">{order.payment_status}</td>
                <td className="px-3 py-2 text-xs">{order.last_action_by || "—"}</td>
                <td className="px-3 py-2 text-right">{formatBRL(order.total)}</td>
                <td className="px-3 py-2 text-right">
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <Link to="/admin/pedidos/$orderId" params={{ orderId: order.id }}>
                      <Eye className="h-3.5 w-3.5" /> Abrir
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-xs text-muted-foreground">{isPending ? "Carregando pedidos…" : error ? "Não foi possível carregar os pedidos." : "Nenhum pedido encontrado."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {error && <Button variant="outline" onClick={() => refetch()} className="mt-4">Tentar novamente</Button>}
      {hasNextPage && <Button variant="outline" disabled={isFetchingNextPage} onClick={() => fetchNextPage()} className="mt-4">{isFetchingNextPage ? "Carregando…" : "Carregar mais pedidos"}</Button>}
    </div>
  );
}
