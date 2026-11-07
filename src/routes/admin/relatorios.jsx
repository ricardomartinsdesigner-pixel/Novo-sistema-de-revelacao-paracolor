import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/areas";

export const Route = createFileRoute("/admin/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Paracolor" }] }),
  component: ReportsPage,
});

const RANGES = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

const AREA_LABELS = {
  revelacao: "Revelação",
  polaroid: "Polaroides",
  banner: "Banners",
  personalizado: "Personalizados",
  moldura: "Molduras",
};

function ReportsPage() {
  const [days, setDays] = useState(30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const revenue = useQuery({
    queryKey: ["report-revenue", days],
    queryFn: () => base44.entities.Order.aggregate({ query: { payment_status: "aprovado", created_date: { $gte: since } }, sum: ["total"] }),
  });
  const byArea = useQuery({
    queryKey: ["report-areas", days],
    queryFn: () => base44.entities.OrderItem.aggregate({ query: { created_date: { $gte: since } }, groupBy: "area", sum: ["line_total"] }),
  });

  const summary = revenue.data?.rows?.[0] ?? { count: 0, sum_total: 0 };
  const areas = (byArea.data?.rows ?? []).sort((a, b) => (b.sum_line_total || 0) - (a.sum_line_total || 0));
  const average = summary.count ? summary.sum_total / summary.count : 0;

  function exportCsv() {
    const lines = [
      ["Período", `${days} dias`],
      ["Pedidos pagos", summary.count],
      ["Faturamento", String(summary.sum_total ?? 0).replace(".", ",")],
      ["Ticket médio", String(average.toFixed(2)).replace(".", ",")],
      [],
      ["Área", "Itens", "Valor"],
      ...areas.map((row) => [AREA_LABELS[row.area] || row.area, row.count, String(row.sum_line_total ?? 0).replace(".", ",")]),
    ];
    const csv = lines.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_paracolor_${days}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Operação</p>
          <h1 className="mt-1 text-3xl">Relatórios</h1>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> Exportar
        </Button>
      </div>

      <div className="mt-5 flex gap-2">
        {RANGES.map((range) => (
          <button
            key={range.days}
            type="button"
            onClick={() => setDays(range.days)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${days === range.days ? "border-primary bg-accent text-primary" : "border-gold/50 bg-gold-soft/40 text-foreground hover:border-gold"}`}
          >
            {range.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Pedidos pagos", value: summary.count },
          { label: "Faturamento", value: formatBRL(summary.sum_total || 0) },
          { label: "Ticket médio", value: formatBRL(average) },
        ].map((card) => (
          <div key={card.label} className="card-glass p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-1 font-display text-2xl">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto card-glass">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Área</th>
              <th className="px-4 py-2">Itens</th>
              <th className="px-4 py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((row) => (
              <tr key={row.area} className="border-t border-border">
                <td className="px-4 py-2">{AREA_LABELS[row.area] || row.area}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{row.count}</td>
                <td className="px-4 py-2 text-right">{formatBRL(row.sum_line_total || 0)}</td>
              </tr>
            ))}
            {!areas.length && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">Nenhum item vendido neste período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}