import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { getSalesReport } from "@/lib/admin-operations-fns";
import { basisLabel, buildSalesPdf, dayLabel, downloadReport, exportSalesCsv, exportSalesExcel, salesReportData } from "@/lib/admin-sales-export";
import SalesPeriodPicker from "@/components/admin/SalesPeriodPicker";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/areas";

export const Route = createFileRoute("/admin/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Paracolor" }] }),
  component: ReportsPage,
});

const PAGE_SIZE = 25;
const dateClass = "mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";

function ReportsPage() {
  const [period, setPeriod] = useState({ days: 30 });
  const [draft, setDraft] = useState(null);
  const [basis, setBasis] = useState("pedido");
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState("");
  const { data: sales, isPending, isError, refetch } = useQuery({
    queryKey: ["admin-orders", "sales-report", period, basis, offset],
    queryFn: () => getSalesReport({ data: { period, basis, offset } }),
  });
  const actual = sales?.period ?? ("from" in period ? period : { from: "", to: "" });
  const dates = draft ?? actual;
  const dirty = Boolean(draft && (draft.from !== actual.from || draft.to !== actual.to));
  const valid = dates.from && dates.to && dates.from <= dates.to;
  const data = sales ? salesReportData(sales, basis) : null;

  function pickDays(days) {
    setPeriod({ days });
    setDraft(null);
    setOffset(0);
  }

  function apply(event) {
    event.preventDefault();
    if (!valid) return;
    setPeriod({ from: dates.from, to: dates.to });
    setDraft(null);
    setOffset(0);
  }

  async function exportReport(format) {
    if (!sales || dirty || busy) return;
    const printWindow = format === "print" ? window.open("", "_blank") : null;
    if (printWindow) {
      printWindow.opener = null;
      printWindow.document.title = "Preparando impressão";
      printWindow.document.body.textContent = "Preparando o relatório em A4…";
    }
    setBusy(format);
    try {
      const full = await getSalesReport({ data: { period: sales.period, basis, full: true } });
      const report = salesReportData(full, basis);
      if (format === "csv") exportSalesCsv(report);
      else if (format === "xlsx") await exportSalesExcel(report);
      else {
        const pdf = await buildSalesPdf(report);
        if (printWindow && !printWindow.closed) {
          pdf.autoPrint();
          const url = URL.createObjectURL(pdf.output("blob"));
          printWindow.location.replace(url);
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } else {
          downloadReport(pdf.output("blob"), report.name + ".pdf");
          if (format === "print") toast.info("Abra o PDF baixado para imprimir em A4.");
        }
      }
    } catch {
      printWindow?.close();
      toast.error("Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Operação</p>
        <h1 className="mt-1 text-3xl">Relatórios</h1>
        <p className="mt-1 text-xs text-muted-foreground">Consulte um dia ou um período e exporte o resultado completo.</p>
      </div>

      <section className="card-glass p-4">
        <h2 className="text-sm font-semibold">Período do relatório</h2>
        <SalesPeriodPicker days={period.days} onChange={pickDays} />
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={apply}>
          <label className="text-xs text-muted-foreground">De
            <input type="date" required className={dateClass} value={dates.from}
              onChange={(event) => setDraft({ ...dates, from: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Até
            <input type="date" required className={dateClass} value={dates.to}
              onChange={(event) => setDraft({ ...dates, to: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Usar a data
            <select value={basis} className={dateClass} onChange={(event) => { setBasis(event.target.value); setOffset(0); }}>
              <option value="pedido">Do pedido</option><option value="recebimento">Do recebimento</option>
            </select>
          </label>
          <Button type="submit" disabled={!valid || !dirty}>Aplicar período</Button>
        </form>
        {dates.from && dates.to && !valid && <p role="alert" className="mt-2 text-xs text-destructive">A data final precisa ser igual ou posterior à inicial.</p>}
        {valid && dirty && <p className="mt-2 text-xs text-muted-foreground">Aplique o novo período para atualizar a tela e as exportações.</p>}
      </section>

      <section className="card-glass p-4">
        <h2 className="text-sm font-semibold">Exportar relatório completo</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {data ? `${data.period} · ${basisLabel(basis)} · Horário de Brasília` : "Carregue um período para exportar."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[["pdf", "PDF"], ["xlsx", "Excel (.xlsx)"], ["csv", "CSV"], ["print", "Imprimir"]].map(([format, label]) => {
            const Icon = format === "print" ? Printer : Download;
            return <Button key={format} variant="outline" size="sm" onClick={() => exportReport(format)}
              disabled={!data || dirty || Boolean(busy)}><Icon /> {busy === format ? "Gerando…" : label}</Button>;
          })}
        </div>
      </section>

      {isError && <div role="alert" className="card-glass p-4 text-sm">
        Não foi possível carregar o relatório. <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
      </div>}
      {isPending && <p role="status" className="text-sm text-muted-foreground">Carregando relatório…</p>}

      {data && <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.summary.map(([label, value, monetary]) => <div key={label} className="card-glass p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-xl">{monetary ? formatBRL(value) : value}</p>
          </div>)}
        </div>
        <section className="card-glass overflow-x-auto">
          <h2 className="p-4 text-sm font-semibold">Vendas por categoria</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/60 text-xs text-muted-foreground">
              <tr><th className="p-3">Categoria</th><th className="p-3">Linhas de itens</th><th className="p-3 text-right">Subtotal dos itens</th></tr>
            </thead>
            <tbody>
              {data.categories.map(([label, count, subtotal]) => <tr key={label} className="border-t border-border">
                <td className="p-3">{label}</td><td className="p-3">{count}</td><td className="p-3 text-right">{formatBRL(subtotal)}</td>
              </tr>)}
              {!data.categories.length && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Nenhum item vendido no período.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="card-glass p-4">
          <h2 className="text-sm font-semibold">Pedidos do período</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr><th className="p-3">Pedido</th><th className="p-3">Data</th><th className="p-3">Cliente</th>
                  <th className="p-3">Status</th><th className="p-3">Pagamento</th><th className="p-3 text-right">Total</th></tr>
              </thead>
              <tbody>
                {data.orders.map(([number, date, customer, status, payment, , , , total], index) => <tr key={sales.details[index].id} className="border-t border-border">
                  <td className="p-3"><a href={`/admin/pedidos/${encodeURIComponent(sales.details[index].id)}`} className="underline">{number}</a></td>
                  <td className="p-3">{date}</td><td className="p-3">{customer}</td><td className="p-3">{status}</td>
                  <td className="p-3">{payment}</td><td className="p-3 text-right">{formatBRL(total)}</td>
                </tr>)}
                {!data.orders.length && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum pedido no período.</td></tr>}
              </tbody>
            </table>
          </div>
          {sales.detailCount > PAGE_SIZE && <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Mostrando {offset + 1} a {offset + data.orders.length} de {sales.detailCount} pedidos</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= sales.detailCount} onClick={() => setOffset(offset + PAGE_SIZE)}>Próxima</Button>
            </div>
          </div>}
        </section>
        <section className="text-xs text-muted-foreground">
          <h2 className="mb-1 font-medium">Como ler o relatório</h2>
          {data.notes.map((note) => <p key={note} className="mb-1">{note}</p>)}
          <p>Datas incluídas de {dayLabel(actual.from)} até {dayLabel(actual.to)}.</p>
        </section>
      </>}
    </div>
  );
}
