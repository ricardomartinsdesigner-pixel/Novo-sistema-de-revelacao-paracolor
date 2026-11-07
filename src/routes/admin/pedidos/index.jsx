import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Eye, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS, STATUS_FLOW, formatBRL, formatDate } from "@/lib/areas";
import { settleQuickDeadlines } from "@/lib/store-fns";
import { useEntityPage } from "@/lib/use-entity-page";

// Pedidos que ainda não entraram em produção: é aqui que o time dá início.
export const PRE_PRODUCTION = [
  "aguardando_pagamento",
  "pagamento_aprovado",
  "aguardando_arte",
  "aguardando_aprovacao",
  "ajustes_solicitados",
  "arte_aprovada",
];

const TAB_QUERIES = {
  iniciar: { status: { $in: PRE_PRODUCTION } },
  andamento: { status: { $nin: ["concluido"] } },
  concluidos: { status: "concluido" },
};

const TABS = [
  { key: "iniciar", label: "Para iniciar" },
  { key: "andamento", label: "Em andamento" },
  { key: "concluidos", label: "Concluídos" },
];

export const Route = createFileRoute("/admin/pedidos/")({
  head: () => ({ meta: [{ title: "Pedidos — Paracolor" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("andamento");
  const [status, setStatus] = useState("todos");
  const [payment, setPayment] = useState("todos");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350); return () => clearTimeout(timer); }, [search]);
  const query = useMemo(() => {
    const next = {};
    // Buscando por cliente (nome ou CPF), todos os pedidos dele aparecem — inclusive os concluídos.
    if (status !== "todos") next.status = status;
    else if (!debouncedSearch) next.status = TAB_QUERIES[view].status;
    if (payment !== "todos") next.payment_status = payment;
    if (debouncedSearch) {
      const escaped = debouncedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      next.$or = ["order_number", "internal_number", "customer_name", "customer_email", "customer_cpf"].map((field) => ({
        [field]: { $regex: escaped, $options: "i" },
      }));
      // CPF digitado com ou sem pontuação: compara só os números.
      const digits = debouncedSearch.replace(/\D/g, "");
      if (digits.length >= 3 && /^[\d.\-\s]+$/.test(debouncedSearch)) {
        next.$or.push({ customer_cpf: { $regex: digits.split("").join("[.\\-\\s]?"), $options: "i" } });
      }
    }
    return next;
  }, [view, status, payment, debouncedSearch]);
  const { records: filtered, isPending, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = useEntityPage("Order", query);
  const { data: total = 0 } = useQuery({ queryKey: ["Order", "count", query], queryFn: () => base44.entities.Order.count(query) });
  const { data: tabCounts = {} } = useQuery({
    queryKey: ["Order", "tab-counts"],
    queryFn: async () => {
      const entries = await Promise.all(
        Object.entries(TAB_QUERIES).map(async ([key, filters]) => [key, await base44.entities.Order.count(filters)])
      );
      return Object.fromEntries(entries);
    },
  });

  // Prazos rápidos vencidos viram "concluído" e saem da lista em andamento.
  useEffect(() => {
    let active = true;
    settleQuickDeadlines()
      .then((result) => { if (active && result?.settled) refetch(); })
      .catch(() => null);
    return () => { active = false; };
  }, []);

  function exportCsv() {
    const header = ["Pedido site", "Número interno", "Data", "Cliente", "Email", "Status", "Pagamento", "Total"];
    const rows = filtered.map((order) => [
      order.order_number,
      order.internal_number || "",
      new Date(order.created_date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      order.customer_name,
      order.customer_email,
      STATUS_LABELS[order.status] || order.status,
      order.payment_status,
      String(order.total).replace(".", ","),
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pedidos_paracolor_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Operação</p>
          <h1 className="mt-1 text-3xl">Pedidos</h1>
          <p className="mt-1 text-xs text-muted-foreground">{filtered.length} carregados · {total} pedidos encontrados</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Exportar pedidos exibidos
        </Button>
      </div>

      <div className={`mt-5 flex-wrap items-center gap-1 rounded-lg border border-border p-1 text-xs ${debouncedSearch ? "hidden" : "inline-flex"}`}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setView(tab.key); setStatus("todos"); }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
              view === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {tab.label}
            {tabCounts[tab.key] ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  tab.key === "iniciar"
                    ? "bg-destructive text-destructive-foreground"
                    : view === tab.key
                      ? "bg-primary-foreground/20"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {tabCounts[tab.key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {debouncedSearch ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          Buscando em todos os pedidos por nome, CPF, e-mail ou número — inclusive os concluídos.
        </p>
      ) : view === "iniciar" ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Pedidos que ainda não entraram em produção — abra o pedido e use “Liberar para produção”.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome do cliente, CPF ou número do pedido"
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
                </td>
                <td className="px-3 py-2">
                  {order.customer_name}
                  <span className="block text-[11px] text-muted-foreground">{order.customer_email}</span>
                  {order.customer_cpf ? (
                    <span className="block text-[11px] text-muted-foreground">CPF {order.customer_cpf}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(order.created_date)}</td>
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