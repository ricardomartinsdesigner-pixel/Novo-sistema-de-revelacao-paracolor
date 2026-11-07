import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { base44 } from "@/api/base44Client";
import { STATUS_LABELS, formatBRL, formatDate } from "@/lib/areas";
import NewOrdersAlert from "@/components/admin/NewOrdersAlert";

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
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => (await base44.entities.Order.list({ sort: "-created_date", limit: 300 })).items ?? [],
  });
  const { data: photos = [] } = useQuery({
    queryKey: ["admin-photos"],
    queryFn: async () => (await base44.entities.OrderPhoto.list({ sort: "-created_date", limit: 300 })).items ?? [],
  });

  const paid = orders.filter((order) => order.payment_status === "aprovado");
  const revenue = paid.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const countBy = (status) => orders.filter((order) => order.status === status).length;

  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const total = orders
      .filter((order) => String(order.created_date).slice(0, 10) === key)
      .reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    return { day: date.toLocaleDateString("pt-BR", { weekday: "short" }), total };
  });

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

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Pedidos" value={orders.length} />
        <Card label="Aguardando pagamento" value={countBy("aguardando_pagamento")} />
        <Card label="Pagos" value={paid.length} />
        <Card label="Faturamento aprovado" value={formatBRL(revenue)} />
        <Card label="Em produção" value={countBy("em_producao")} />
        <Card label="Prontos" value={countBy("pronto")} />
        <Card label="Concluídos" value={countBy("concluido")} />
        <Card label="Fotos vendidas" value={photos.length} hint="fotos registradas no período" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="card-glass p-5">
          <h2 className="text-lg">Pedidos dos últimos 7 dias</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
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
            {!orders.length && <li className="text-xs text-muted-foreground">Nenhum pedido ainda.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}