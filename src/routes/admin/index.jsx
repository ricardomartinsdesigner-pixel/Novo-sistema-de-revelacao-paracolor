import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { getAdminSales } from "@/lib/admin-operations-fns";
import SalesPeriodPicker from "@/components/admin/SalesPeriodPicker";
import { STATUS_LABELS, formatBRL, formatDate } from "@/lib/areas";
import NewOrdersAlert from "@/components/admin/NewOrdersAlert";
import SiteAnalyticsPanel from "@/components/admin/SiteAnalyticsPanel";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Paracolor" }] }),
  component: Dashboard,
});

function Card({ label, value, hint }) {
  return (
    <div className="card-glass p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Dashboard() {
  const [days, setDays] = useState(7);
  const { data: sales, isPending, isError } = useQuery({
    queryKey: ["admin-orders", "sales", days, "pedido"],
    queryFn: () => getAdminSales({ data: { days } }),
    refetchInterval: 60_000,
  });
  const countBy = (status) => sales ? sales.statuses[status] ?? 0 : "—";
  const chart = sales?.daily.map(({ day, total }) => ({
    day: day.slice(8) + "/" + day.slice(5, 7),
    total,
  })) ?? [];
  const orders = sales?.recent ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Visão geral</p>
          <h1 className="mt-1 text-3xl">Dashboard</h1>
        </div>
        <Link to="/admin/pedidos" className="text-sm text-primary hover:underline">Ver todos os pedidos</Link>
      </div>

      <NewOrdersAlert />
      <SiteAnalyticsPanel />

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {[["Produção atrasada", sales?.overdue, "/admin/producao"],
          ["Retiradas prontas", sales?.readyPickup, "/admin/entregas"],
          ["Pagamentos pendentes", sales?.pendingPayment, "/admin/pagamentos"]].map(([label, count, to]) =>
          <Link key={label} to={to}><Card label={label} value={count ?? "—"} /></Link>)}
      </div>
      <SalesPeriodPicker days={days} onChange={setDays} />
      <p className="mt-2 text-xs text-muted-foreground">
        {isError ? "Não foi possível carregar os indicadores." : isPending ? "Carregando indicadores…" : "Período pela data do pedido, no horário de Brasília."}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Pedidos" value={sales?.orderCount ?? "—"} />
        <Card label="Aguardando pagamento" value={countBy("aguardando_pagamento")} />
        <Card label="Pagos" value={sales?.paidCount ?? "—"} />
        <Card label="Faturamento aprovado" value={sales ? formatBRL(sales.revenue) : "—"} />
        <Card label="Em produção" value={countBy("em_producao")} />
        <Card label="Prontos" value={countBy("pronto")} />
        <Card label="Concluídos" value={countBy("concluido")} />
        <Card label="Retirados" value={countBy("retirado")} />
        <Card label="Fotos vendidas" value={sales?.photoCopies ?? "—"} hint="Cópias de revelação e polaroides em pedidos pagos" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="card-glass p-5">
          <h2 className="text-lg">Faturamento aprovado por dia</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={40} />
                <Tooltip formatter={(value) => formatBRL(value)} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-glass p-5">
          <h2 className="text-lg">Últimos pedidos</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {orders.slice(0, 6).map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
                <div>
                  <Link to="/admin/pedidos/$orderId" params={{ orderId: order.id }} className="font-medium hover:text-primary">
                    {order.order_number}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">{order.customer_name} · {formatDate(order.created_date)}</p>
                </div>
                <div className="text-right">
                  <p>{formatBRL(order.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{STATUS_LABELS[order.status] || order.status}</p>
                </div>
              </li>
            ))}
            {sales && !orders.length && <li className="text-xs text-muted-foreground">Nenhum pedido no período.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
