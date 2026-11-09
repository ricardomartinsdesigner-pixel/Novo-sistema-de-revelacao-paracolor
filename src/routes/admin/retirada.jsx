import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, PackageCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatBRL, STATUS_LABELS } from "@/lib/areas";
import { resolvePickupQr } from "@/lib/pickup-qr-fns";

export const Route = createFileRoute("/admin/retirada")({
  head: () => ({ meta: [{ title: "Retirada por QR Code — Paracolor" }] }),
  validateSearch: (search) => ({ token: typeof search.token === "string" ? search.token.slice(0, 120) : "" }),
  component: PickupQrPage,
});

function PickupQrPage() {
  const { token } = Route.useSearch();
  const queryClient = useQueryClient();
  const resolve = useServerFn(resolvePickupQr);
  const queryKey = ["pickup-qr-resolution", token];
  const query = useQuery({
    queryKey,
    enabled: token.length >= 32,
    queryFn: () => resolve({ data: { token, action: "scan" } }),
    retry: false,
    staleTime: 60_000,
  });
  const mutation = useMutation({
    mutationFn: (action) => resolve({ data: { token, action } }),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      queryClient.invalidateQueries({ queryKey: ["Order"] });
      if (result.state === "retired") toast.success("Retirada registrada.");
      if (result.state === "undone") toast.success("Baixa desfeita. O pedido voltou para pronto para retirada.");
    },
    onError: (error) => toast.error(error?.message || "Não foi possível atualizar a retirada."),
  });
  const result = query.data;
  const order = result?.order;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow">Atendimento de balcão</p>
      <h1 className="mt-1 text-3xl">Retirada por QR Code</h1>
      {!token && <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Nenhum QR Code foi informado. Leia o código exibido pelo cliente usando a câmera do celular da equipe.</p>}
      {token && query.isPending && <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Consultando pedido…</p>}
      {query.isError && <p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{query.error?.message || "QR Code inválido ou sem permissão para leitura."}</p>}
      {result?.state === "not_ready" && <Message tone="warning" title="Pedido ainda não está pronto" text={result.message} />}
      {result?.state === "payment_pending" && <Message tone="warning" title="Pagamento pendente" text={result.message} />}
      {result?.state === "collect_payment" && <Message tone="warning" title="Confirme o recebimento no balcão" text={result.message} />}
      {result?.state === "approval_pending" && <Message tone="warning" title="Aprovação pendente" text={result.message} />}
      {result?.state === "confirmation_required" && <Message tone="neutral" title="Confirme a retirada" text="Confira o pedido antes de registrar a baixa." />}
      {result?.state === "view_only" && <Message tone="neutral" title="Consulta realizada" text="O comportamento do QR Code está configurado para abrir o pedido sem alterar o status." />}
      {result?.state === "already_retired" && <Message tone="success" title="Pedido já retirado" text="Este QR Code já foi utilizado e a retirada está registrada." />}
      {result?.state === "retired" && <Message tone="success" title="Retirada registrada" text={result.payment_collected ? "Pagamento recebido e pedido marcado como retirado." : "O pedido foi marcado como retirado no sistema."} />}
      {result?.state === "undone" && <Message tone="neutral" title="Baixa desfeita" text="O pedido voltou para pronto para retirada." />}

      {order && <section className="mt-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{order.order_number}</p>
            <h2 className="mt-1 text-xl">{order.customer_name}</h2>
          </div>
          <span className="rounded-full bg-accent px-3 py-1 text-xs">{STATUS_LABELS[order.status] || order.status}</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Pagamento: {order.payment_status} · Total {formatBRL(order.total)}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {["confirmation_required", "collect_payment"].includes(result.state) && <Button onClick={() => mutation.mutate("confirm")} disabled={mutation.isPending} className="gap-1.5">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            {result.state === "collect_payment" ? "Confirmar pagamento e retirada" : "Confirmar retirada"}
          </Button>}
          {result.undo_available && <Button type="button" variant="outline" onClick={() => mutation.mutate("undo")} disabled={mutation.isPending} className="gap-1.5">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Desfazer baixa
          </Button>}
          {result.state === "retired" && <span className="inline-flex items-center gap-1.5 py-2 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Registrado agora</span>}
          <Button asChild variant="outline"><Link to="/admin/pedidos/$orderId" params={{ orderId: order.id }}>Abrir pedido</Link></Button>
        </div>
      </section>}
    </div>
  );
}

function Message({ tone, title, text }) {
  const styles = tone === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-900"
    : tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-border bg-secondary/50 text-foreground";
  return <div className={`mt-5 rounded-xl border p-4 ${styles}`}><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs">{text}</p></div>;
}
