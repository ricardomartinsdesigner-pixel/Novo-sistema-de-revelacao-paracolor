import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { updateOrderStatus } from "@/lib/store-fns";
import MercadoPagoConfig from "@/components/admin/MercadoPagoConfig";
import { formatBRL, formatDate } from "@/lib/areas";

export const Route = createFileRoute("/admin/pagamentos")({
  head: () => ({ meta: [{ title: "Pagamentos — Paracolor" }] }),
  component: PaymentsPage,
});

const LABELS = {
  pendente: "Aguardando pagamento",
  aprovado: "Aprovado",
  recusado: "Recusado",
  reembolsado: "Reembolsado",
};

function PaymentsPage() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState("");
  const confirm = useServerFn(updateOrderStatus);

  const totals = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => base44.entities.Order.aggregate({ query: {}, groupBy: "payment_status", sum: ["total"] }),
  });
  const pending = useQuery({
    queryKey: ["admin-payments-pending"],
    queryFn: async () =>
      (await base44.entities.Order.filter({ payment_status: "pendente" }, { sort: "-created_date", limit: 60 })).items ?? [],
  });

  const mutation = useMutation({
    mutationFn: (order) => confirm({ data: { order_id: order.id, status: "pagamento_aprovado", note: "Pagamento confirmado no painel" } }),
    onMutate: (order) => setBusyId(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments-pending"] });
      toast.success("Pagamento confirmado");
    },
    onError: (error) => toast.error(error.message || "Não foi possível confirmar o pagamento."),
    onSettled: () => setBusyId(""),
  });

  const rows = totals.data?.rows ?? [];

  return (
    <div>
      <p className="eyebrow">Financeiro</p>
      <h1 className="mt-1 text-3xl">Pagamentos</h1>

      <div className="mt-5">
        <MercadoPagoConfig />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(LABELS).map(([key, label]) => {
          const row = rows.find((item) => item.payment_status === key);
          return (
            <div key={key} className="card-glass p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 font-display text-2xl">{row?.count ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">{formatBRL(row?.sum_total ?? 0)}</p>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 text-xl">Aguardando confirmação</h2>
      <div className="mt-3 overflow-x-auto card-glass">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Pedido</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(pending.data ?? []).map((order) => (
              <tr key={order.id} className="border-t border-border">
                <td className="px-4 py-2">
                  <Link to="/admin/pedidos/$orderId" params={{ orderId: order.id }} className="font-medium hover:text-primary">
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{order.customer_name}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(order.created_date)}</td>
                <td className="px-4 py-2 text-right">{formatBRL(order.total)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => mutation.mutate(order)}
                    disabled={busyId === order.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gold px-2 py-1 text-xs text-gold-deep transition hover:bg-gold-soft disabled:opacity-50"
                  >
                    {busyId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Confirmar
                  </button>
                </td>
              </tr>
            ))}
            {!(pending.data ?? []).length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">Nenhum pagamento pendente.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}