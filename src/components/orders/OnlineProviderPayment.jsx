import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PAYMENT_PROVIDERS } from "@/lib/payment-providers";
import { checkProviderPayment, createPayment } from "@/lib/store-fns";
import { formatDate } from "@/lib/areas";

const terminal = ["aprovado", "reembolsado", "teste_aprovado"];

export default function OnlineProviderPayment({ order, search, onUpdate }) {
  const [qr, setQr] = useState("");
  const closed = terminal.includes(order.payment_status) || order.status === "cancelado";
  const check = useQuery({
    queryKey: ["provider-payment", order.id, search.transaction_nsu, search.slug, search.order_nsu],
    enabled: !closed, retry: false,
    queryFn: () => checkProviderPayment({ data: {
      order_id: order.id, transaction: search.transaction_nsu, slug: search.slug, ref: search.order_nsu,
    } }),
    refetchInterval: (query) => query.state.data?.expiresAt && !terminal.includes(query.state.data.state) ? 10000 : false,
  });
  const data = check.data;
  const pay = useMutation({
    mutationFn: () => createPayment({ data: { order_id: order.id } }),
    onSuccess: (result) => {
      if (result.init_point) window.location.assign(result.init_point);
      else {
        if (result.message) toast.info(result.message);
        void check.refetch();
      }
    },
    onError: (error) => toast.error(error.message || "Não foi possível iniciar o pagamento."),
  });

  useEffect(() => { if (data?.state && data.state !== order.payment_status) void onUpdate(); }, [data?.state, order.payment_status, onUpdate]);
  useEffect(() => {
    let active = true;
    setQr("");
    if (data?.code) import("qrcode").then(({ default: QR }) => QR.toDataURL(data.code, { width: 240, margin: 2 }))
      .then((url) => { if (active) setQr(url); }).catch(() => {});
    return () => { active = false; };
  }, [data?.code]);

  async function copy() {
    try { await navigator.clipboard.writeText(data.code); toast.success("Código Pix copiado."); }
    catch { toast.info("Selecione o código Pix para copiar."); }
  }

  return <div className="mt-3 rounded-lg bg-secondary p-3 text-sm">
    <p className="font-medium">{PAYMENT_PROVIDERS[order.payment_method].label}</p>
    {!closed && <>
      {data?.expired ? <p className="mt-2">A cobrança venceu. Se você já pagou, aguarde a conferência ou fale com a loja.</p>
        : data?.inReview ? <p className="mt-2">A cobrança está em conferência. Acompanhe o status nesta página.</p>
        : data?.code ? <div className="mt-2 space-y-2">
          {qr && <img src={qr} alt="QR Code Pix deste pedido" className="mx-auto max-w-full rounded-md" width="240" height="240" />}
          <label className="block text-xs font-medium">Pix Copia e Cola
            <textarea readOnly value={data.code} rows={3} className="mt-1 block w-full rounded border border-input bg-background p-2 text-xs" />
          </label>
          <Button size="sm" variant="outline" onClick={copy}>Copiar Pix</Button>
        </div> : <Button className="mt-2" size="sm" disabled={pay.isPending || check.isPending} onClick={() => pay.mutate()}>
          {data?.init_point ? "Abrir pagamento" : order.payment_method === "sicoob_pix" ? "Gerar Pix" : "Pagar agora"}
        </Button>}
      {data?.expiresAt && !data.expired && <p className="mt-2 text-xs text-muted-foreground">Validade {formatDate(data.expiresAt)}</p>}
      {data?.expiresAt && <Button className="mt-2" variant="ghost" size="sm" disabled={check.isFetching} onClick={() => check.refetch()}>
        Atualizar status
      </Button>}
      {check.isError && <p className="mt-2 text-xs" role="alert">Não foi possível consultar a cobrança. Tente novamente em instantes.</p>}
    </>}
  </div>;
}
