import { nextOrderStep } from "@/lib/customer-order";
import OnlineProviderPayment from "@/components/orders/OnlineProviderPayment";
import { isNewOnlinePayment } from "@/lib/payment-providers";
import OrderPhotoGallery from "@/components/orders/OrderPhotoGallery";
import { listOrderPhotos } from "@/lib/photo-order";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Download, Loader2, Package, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { createDownloadLink, createPayment } from "@/lib/store-fns";
import { useSignedUrl, useSettings } from "@/lib/store";
import { Image } from "@/components/ui/image";
import OrderItemOptions from "@/components/orders/OrderItemOptions";
import OrderCountdown from "@/components/orders/OrderCountdown";
import { STATUS_LABELS, formatBRL, formatDate } from "@/lib/areas";
import { awaitsPickupPayment, isPickupPaymentOrder, ONLINE_PAYMENT, PAYMENT_METHOD_LABELS, STORE_PAYMENT } from "@/lib/order-payment";
import PickupQrCode from "@/components/orders/PickupQrCode";

export const Route = createFileRoute("/_site/_authed/pedido/$orderId")({
  head: () => ({ meta: [{ title: "Seu pedido — Paracolor" }] }),
  validateSearch: (search) => ({
    pagamento: ["sucesso", "pendente", "falha"].includes(search.pagamento) ? search.pagamento : undefined,
    transaction_nsu: typeof search.transaction_nsu === "string" ? search.transaction_nsu.slice(0, 150) : undefined,
    slug: typeof search.slug === "string" ? search.slug.slice(0, 200) : undefined,
    order_nsu: typeof search.order_nsu === "string" ? search.order_nsu.slice(0, 120) : undefined,
  }),
  component: OrderPage,
});

function OrderPhoto({ photo }) {
  const url = useSignedUrl(photo.print_file_uri || photo.original_file_uri);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="aspect-square bg-secondary">
        {url ? <Image src={url} alt={photo.filename} className="h-full w-full object-contain" fittingType="fit" /> : null}
      </div>
      <div className="p-2">
        <p className="truncate text-[11px] font-medium">{photo.size_name || "foto"}</p>
        <p className="text-[10px] text-muted-foreground">
          {photo.copies > 1 ? `${photo.copies}x · ` : ""}
          {photo.fit_mode === "contain" ? "inteira" : "preenchida"}
        </p>
        {photo.caption ? <p className="truncate text-[10px] italic text-muted-foreground">“{photo.caption}”</p> : null}
      </div>
    </div>
  );
}

function OrderPage() {
  const { orderId } = Route.useParams();
  const [downloading, setDownloading] = useState("");
  const [paying, setPaying] = useState(false);
  const search = Route.useSearch();
  const { pagamento } = search;
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (pagamento !== "sucesso" && pagamento !== "pendente") {
      setChecking(false);
      return;
    }
    setChecking(true);
    const timeout = setTimeout(() => setChecking(false), 75_000);
    return () => clearTimeout(timeout);
  }, [orderId, pagamento]);
  const { settings } = useSettings();

  const { data: order, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => base44.entities.Order.get(orderId),
    refetchInterval: (query) => {
      const data = query.state.data;
      return checking && data?.payment_method === ONLINE_PAYMENT && data.payment_status === "pendente" && data.status !== "cancelado" ? 4000 : false;
    },
  });
  const { data: items = [] } = useQuery({
    queryKey: ["order-items", orderId],
    queryFn: async () => (await base44.entities.OrderItem.filter({ order_id: orderId }, { limit: 100 })).items ?? [],
  });
  const { data: photos = [] } = useQuery({
    queryKey: ["order-photos", orderId],
    queryFn: () => listOrderPhotos(base44.entities, orderId),
  });

  if (isLoading) {
    return <div className="container-x flex items-center gap-2 py-24 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando pedido…</div>;
  }
  if (!order) {
    return <div className="container-x py-24 text-center text-sm text-muted-foreground">Pedido não encontrado.</div>;
  }

  const pendingOnline = order.payment_method === ONLINE_PAYMENT && order.payment_status === "pendente" && order.status !== "cancelado";

  async function download(only) {
    setDownloading(only);
    try {
      const link = await createDownloadLink({ data: { order_id: order.id, only } });
      window.location.href = link.url;
    } catch (error) {
      toast.error(error?.message || "Não foi possível gerar o download.");
    } finally {
      setDownloading("");
    }
  }

  async function payNow() {
    setPaying(true);
    try {
      const payment = await createPayment({ data: { order_id: order.id } });
      if (payment.init_point) {
        window.location.href = payment.init_point;
        return;
      }
      toast.warning(payment.message, { duration: 8000 });
    } catch (error) {
      toast.error(error?.message || "Não foi possível iniciar o pagamento.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="container-x py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{order.order_number}</p>
          <h1 className="mt-2 text-4xl">Pedido {order.order_number}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Criado em {formatDate(order.created_date)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => download("all")} disabled={Boolean(downloading)} className="gap-1.5">
            {downloading === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar arquivos
          </Button>
          {settings?.online_payment_enabled && !isNewOnlinePayment(order.payment_method) && !(pendingOnline && checking) && !isPickupPaymentOrder(order)
            && !["aprovado", "reembolsado"].includes(order.payment_status) && order.status !== "cancelado" && (
            <Button onClick={payNow} disabled={paying} className="gap-1.5">
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Pagar agora
            </Button>
          )}
        </div>
      </div>

      <p className="mt-5 rounded-xl border border-primary/25 bg-accent/60 p-4 text-sm"><strong>Próximo passo:</strong> {nextOrderStep(order)}</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-[1.25rem] border border-border bg-card p-6">
            <h2 className="text-xl">Itens</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 border-b border-border/60 pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variant} {item.qty ? `· ${item.qty} un` : ""}
                      {item.photo_count ? ` · ${item.photo_count} foto(s)` : ""}
                    </p>
                    <OrderItemOptions item={item} />
                  </div>
                  <span>{formatBRL(item.line_total)}</span>
                </li>
              ))}
            </ul>
          </section>

          {photos.length > 0 && (
            <section className="rounded-[1.25rem] border border-border bg-card p-6">
              <h2 className="text-xl">Fotos do pedido</h2>
              <OrderPhotoGallery key={orderId} photos={photos} Photo={OrderPhoto} className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4" />
            </section>
          )}

          <section className="rounded-[1.25rem] border border-border bg-card p-6">
            <h2 className="text-xl">Histórico</h2>
            <ol className="mt-4 space-y-3">
              {(order.status_history ?? []).map((entry, index) => (
                <li key={`${entry.status}-${index}`} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-primary" />
                  <div>
                    <p className="font-medium">{STATUS_LABELS[entry.status] || entry.status}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.date)} · {entry.by}</p>
                    {entry.note ? <p className="text-xs text-muted-foreground">{entry.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[1.25rem] border border-border bg-card p-6">
            <h2 className="text-lg">Status</h2>
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
              <Package className="h-3.5 w-3.5" /> {STATUS_LABELS[order.status] || order.status}
            </p>
            {order.quick_due_at && order.status === "em_producao" ? (
              <div className="mt-3 rounded-xl border border-gold/40 bg-gold-soft px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-gold-deep">Fica pronto em</p>
                <OrderCountdown dueAt={order.quick_due_at} className="mt-0.5 block text-xl font-medium" />
                <p className="mt-0.5 text-[11px] text-muted-foreground">Prazo de {order.quick_label || "produção"}</p>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              Pagamento: <strong className="text-foreground">{order.payment_status === "teste_aprovado" ? "aprovado em homologação" : order.payment_status}</strong>
            </p>
            {isNewOnlinePayment(order.payment_method) && <OnlineProviderPayment order={order} search={search} onUpdate={refetch} />}
            {pendingOnline && (
              <div className="mt-3 rounded-lg bg-secondary px-3 py-2 text-xs" aria-live="polite">
                <p className="font-medium">Aguardando confirmação do pagamento</p>
                <p className="mt-1 text-muted-foreground">
                  {checking ? "Estamos consultando a confirmação. Se você já pagou, aguarde nesta tela." : "Se você já pagou, atualize o status antes de tentar um novo pagamento."}
                </p>
                {!checking && <Button size="sm" variant="outline" className="mt-2" disabled={isFetching} onClick={() => refetch()}>
                  {isFetching ? "Atualizando…" : "Atualizar status"}
                </Button>}
              </div>
            )}
            {isPickupPaymentOrder(order) && <p className="mt-1 text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[order.payment_method]}</p>}
            {awaitsPickupPayment(order) && (
              <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-xs text-foreground">
                Você paga {formatBRL(order.total)} no balcão quando retirar este pedido.
              </p>
            )}
            {order.payment_method === STORE_PAYMENT && order.payment_status === "pendente" && <p className="mt-2 text-xs text-muted-foreground">Pedido registrado. Combine o pagamento com a loja; a produção ainda não está liberada.</p>}
            {order.fulfillment === "entrega" ? (
              <p className="mt-1 text-xs text-muted-foreground">Entrega: {order.shipping_address}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Retirada na loja</p>
            )}
            {order.fulfillment === "retirada" && <PickupQrCode order={order} />}
            {order.production_deadline_label || order.production_days ? (
              <p className="mt-1 text-xs text-muted-foreground">Prazo de produção: {order.production_deadline_label || `${order.production_days} dia(s) úteis`}</p>
            ) : null}
          </section>

          {order.art_approval_requested && (
            <section className="rounded-[1.25rem] border border-border bg-card p-6">
              <h2 className="text-lg">Aprovação de arte</h2>
              <p className="mt-2 flex items-center gap-2 text-xs">
                {order.art_approval_status === "aprovada" ? (
                  <><Check className="h-4 w-4 text-emerald-600" /> Arte aprovada</>
                ) : order.art_approval_status === "ajustes" ? (
                  <><XCircle className="h-4 w-4 text-red-600" /> Ajustes solicitados</>
                ) : (
                  <>Aguardando aprovação pelo WhatsApp</>
                )}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                A produção só começa depois do registro da aprovação pela nossa equipe.
              </p>
            </section>
          )}

          <section className="rounded-[1.25rem] border border-border bg-card p-6">
            <h2 className="text-lg">Valores</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatBRL(order.subtotal)}</dd></div>
              {order.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Desconto{order.discount_label ? " · " + order.discount_label : ""}</dt><dd>-{formatBRL(order.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted-foreground">Frete</dt><dd>{formatBRL(order.shipping_cost || 0)}</dd></div>
              <div className="flex justify-between border-t border-border pt-2 font-medium"><dt>Total</dt><dd>{formatBRL(order.total)}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => download("impressao")}>Impressão</Button>
              <Button size="sm" variant="outline" onClick={() => download("originais")}>Originais</Button>
              <Button size="sm" variant="outline" onClick={() => download("polaroids")}>Polaroids</Button>
            </div>
          </section>

          <Button asChild variant="outline" className="w-full rounded-full">
            <Link to="/minha-conta">Voltar para meus pedidos</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
