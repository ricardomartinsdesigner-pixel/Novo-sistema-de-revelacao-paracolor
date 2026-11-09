import PaymentRoutingSettings from "@/components/admin/PaymentRoutingSettings";
import { OrderQueueSearch, OrderQueueFooter, useOrderQueue } from "@/components/admin/OrderQueueControls";
import AdminMfaSettings from "@/components/admin/AdminMfaSettings";
import PaymentProviderSettings from "@/components/admin/PaymentProviderSettings";
import { PAYMENT_METHOD_LABELS, isOnlinePayment } from "@/lib/order-payment";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getAdminPaymentTotals } from "@/lib/admin-operations-fns";
import { checkProviderPayment, updateOrderStatus } from "@/lib/store-fns";
import MercadoPagoConfig from "@/components/admin/MercadoPagoConfig";
import StorePaymentSettings from "@/components/admin/StorePaymentSettings";
import OrderCustomerBadges from "@/components/admin/OrderCustomerBadges";
import { formatBRL, formatDate } from "@/lib/areas";
import { awaitsPickupPayment } from "@/lib/order-payment";

export const Route = createFileRoute("/admin/pagamentos")({
  head: () => ({ meta: [{ title: "Pagamentos — Paracolor" }] }),
  component: PaymentsPage,
});

const LABELS = {
  pendente: "Aguardando pagamento",
  aprovado: "Aprovado",
  recusado: "Recusado",
  reembolsado: "Reembolsado",
  teste_aprovado: "Teste aprovado",
};

function PaymentsPage() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState("");
  const confirm = useServerFn(updateOrderStatus);

  const totals = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => getAdminPaymentTotals(),
  });
  const pending = useOrderQueue("payments", "admin-payments-pending");

  const mutation = useMutation({
    mutationFn: (order) => isOnlinePayment(order.payment_method) ? checkProviderPayment({ data: { order_id: order.id } }) : confirm({ data: {
      order_id: order.id, status: "pagamento_aprovado",
      note: awaitsPickupPayment(order) ? "Recebimento no balcão confirmado." : "Pagamento confirmado no painel",
    } }),
    onMutate: (order) => setBusyId(order.id),
    onSuccess: (result, order) => {
      if (isOnlinePayment(order.payment_method) && result.state !== "aprovado") toast.info("Status conferido. A confirmação depende do provedor.");
      else toast.success("Pagamento confirmado");
      return Promise.all([
        ["admin-payments"], ["admin-payments-pending"], ["admin-entregas"], ["admin-producao"], ["admin-new-orders"], ["admin-orders"], ["Order"], ["admin-order", order.id],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: (error) => toast.error(error.message || "Não foi possível confirmar o pagamento."),
    onSettled: () => setBusyId(""),
  });

  const rows = totals.data?.rows ?? [];

  return (
    <div>
      <p className="eyebrow">Financeiro</p>
      <h1 className="mt-1 text-3xl">Pagamentos</h1>



      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(LABELS).map(([key, label]) => {
          const row = rows.find((item) => item.payment_status === key);
          return (
            <div key={key} className="card-glass p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 font-display text-2xl">{totals.data ? row?.count ?? 0 : "—"}</p>
              <p className="text-[11px] text-muted-foreground">{totals.data ? formatBRL(row?.sum_total ?? 0) : "—"}</p>
            </div>
          );
        })}
      </div>

      {totals.isError && <p role="alert" className="mt-3 text-sm text-destructive">Não foi possível carregar os totais.{" "}
        <button type="button" className="underline" onClick={() => totals.refetch()}>Tentar novamente</button>
      </p>}
      <h2 className="mt-8 text-xl">Aguardando confirmação</h2>
      <OrderQueueSearch queue={pending} />
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
            {pending.orders.map((order) => (
              <tr key={order.id} className="border-t border-border">
                <td className="px-4 py-2">
                  <Link to="/admin/pedidos/$orderId" params={{ orderId: order.id }} className="font-medium hover:text-primary">
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {order.customer_name}
                  <OrderCustomerBadges order={order} />
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(order.created_date)}
                  <span className="block">{PAYMENT_METHOD_LABELS[order.payment_method] || "Pagamento local"}</span>
                </td>
                <td className="px-4 py-2 text-right">{formatBRL(order.total)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => mutation.mutate(order)}
                    disabled={busyId === order.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gold px-2 py-1 text-xs text-gold-deep transition hover:bg-gold-soft disabled:opacity-50"
                  >
                    {busyId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    {isOnlinePayment(order.payment_method) ? "Consultar provedor" : awaitsPickupPayment(order) ? "Confirmar recebimento" : "Confirmar"}
                  </button>
                </td>
              </tr>
            ))}
            {!pending.orders.length && !pending.isPending && !pending.isError && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">Nenhum pagamento pendente.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <OrderQueueFooter queue={pending} />
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium">Integrações e configurações de pagamento</summary>
        <MercadoPagoConfig />
        <PaymentProviderSettings />
        <PaymentRoutingSettings />
        <AdminMfaSettings />
        <StorePaymentSettings />
      </details>
    </div>
  );
}
