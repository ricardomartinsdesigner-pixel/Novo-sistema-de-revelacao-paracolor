import { needsArtApproval, PRODUCTION_START_STATUSES } from "@/lib/order-production";
import { isOnlinePayment } from "@/lib/order-payment";
import { listOrderNotices } from "@/lib/email-fns";
import OrderPhotoGallery from "@/components/orders/OrderPhotoGallery";
import { listOrderPhotos } from "@/lib/photo-order";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Download, FileText, Loader2, MessageCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { useSignedUrl, useSettings } from "@/lib/store";
import { checkProviderPayment, createDownloadLink, setArtApproval, updateOrderStatus } from "@/lib/store-fns";
import { STATUS_FLOW, STATUS_LABELS, formatBRL, formatDate } from "@/lib/areas";
import { AREA_LABELS, orderLabel, sizeLabel } from "@/lib/order-paths";
import OrderItemOptions from "@/components/orders/OrderItemOptions";
import OrderHeaderCard from "@/components/admin/OrderHeaderCard";
import OrderDeadlinePanel from "@/components/admin/OrderDeadlinePanel";
import { awaitsPickupPayment, canProduceOrder } from "@/lib/order-payment";
import { productionSummary } from "@/lib/order-summary";
import { canUpdateOrderAsStaff, hasStaffAccess } from "@/lib/staff-access";
import { markOrderAlertAsViewed } from "@/lib/admin-operations-fns";

export const Route = createFileRoute("/admin/pedidos/$orderId")({
  head: () => ({ meta: [{ title: "Detalhe do pedido — Paracolor" }] }),
  component: OrderDetail,
});

function PhotoRow({ photo }) {
  const url = useSignedUrl(photo.print_file_uri || photo.original_file_uri);
  return (
    <div className="flex gap-3 rounded-lg border border-border p-2">
      <div className="h-16 w-16 flex-none overflow-hidden rounded bg-secondary">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 text-[11px]">
        <p className="truncate font-medium text-xs">{photo.filename || "foto"}</p>
        <p className="text-muted-foreground">{photo.size_name} · {photo.width_cm}x{photo.height_cm} cm · {photo.copies || 1}x</p>
        <p className="text-muted-foreground">{photo.fit_mode === "contain" ? "inteira" : "preenchida"} · {photo.quality || "—"}</p>
        {photo.caption ? <p className="truncate italic text-muted-foreground">“{photo.caption}”</p> : null}
        {photo.alerts?.length ? <p className="text-amber-700">{photo.alerts.join(", ")}</p> : null}
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
            abrir arquivo
          </a>
        ) : null}
      </div>
    </div>
  );
}

function OrderDetail() {
  const { orderId } = Route.useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canDownload = hasStaffAccess(user, "production");
  const canEditArt = hasStaffAccess(user, "art");
  const canEditDeadline = hasStaffAccess(user, "production");
  const canCollectPayment = hasStaffAccess(user, "payments");
  const { settings } = useSettings();
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [artUri, setArtUri] = useState("");
  const [artNote, setArtNote] = useState("");
  const [internalNumber, setInternalNumber] = useState(null);
  const [savingNumber, setSavingNumber] = useState(false);
  const markedViewedRef = useRef("");

  const { data: order, isLoading, error: orderError, refetch: retryOrder } = useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: () => base44.entities.Order.get(orderId),
  });
  const { data: items = [], isSuccess: itemsReady } = useQuery({
    queryKey: ["admin-order-items", orderId],
    queryFn: async () => (await base44.entities.OrderItem.filter({ order_id: orderId }, { limit: 100 })).items ?? [],
    enabled: Boolean(order),
  });
  const { data: photos = [], isSuccess: photosReady } = useQuery({
    queryKey: ["admin-order-photos", orderId],
    queryFn: () => listOrderPhotos(base44.entities, orderId),
    enabled: Boolean(order),
  });

  const { data: notices = [] } = useQuery({
    queryKey: ["admin-order-notices", orderId],
    queryFn: () => listOrderNotices({ data: { orderId } }),
    enabled: Boolean(order),
    refetchInterval: (query) => query.state.data?.some((entry) => ["na fila", "tentando novamente"].includes(entry.status)) ? 10_000 : false,
  });
  const artUrl = useSignedUrl(artUri || order?.art_file_uri);

  const markViewed = useCallback(() => {
    if (!order?.id || markedViewedRef.current === order.id) return;
    markedViewedRef.current = order.id;
    queryClient.setQueryData(["admin-unread-order-alerts"], (current) => current ? {
      ...current,
      items: (current.items || []).filter((item) => item.id !== order.id),
      total: Math.max(0, Number(current.total || 0) - ((current.items || []).some((item) => item.id === order.id) ? 1 : 0)),
    } : current);
    queryClient.setQueryData(["admin-new-orders"], (current) => {
      if (!current) return current;
      const removeViewedOrder = (group) => {
        const found = (group?.orders || []).some((item) => item.id === order.id);
        return {
          ...group,
          orders: (group?.orders || []).filter((item) => item.id !== order.id),
          total: Math.max(0, Number(group?.total || 0) - (found ? 1 : 0)),
        };
      };
      return { ready: removeViewedOrder(current.ready), waiting: removeViewedOrder(current.waiting) };
    });
    void markOrderAlertAsViewed({ data: { order_id: order.id } }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["admin-unread-order-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-new-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["Order", "admin-pages"] });
    }).catch(() => {
      markedViewedRef.current = "";
      void queryClient.invalidateQueries({ queryKey: ["admin-unread-order-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-new-orders"] });
    });
  }, [order?.id, queryClient]);

  useEffect(() => { markViewed(); }, [markViewed]);

  useEffect(() => {
    function handleLiveOrderAlert(event) {
      if (!order?.id || !event.detail?.ids?.includes(order.id)) return;
      markedViewedRef.current = "";
      markViewed();
    }
    window.addEventListener("paracolor:order-alert", handleLiveOrderAlert);
    return () => window.removeEventListener("paracolor:order-alert", handleLiveOrderAlert);
  }, [markViewed, order?.id]);

  if (isLoading) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando pedido…</p>;
  }

  if (!order) {
    const missing = orderError?.status === 404 || /não encontrado|nao encontrado/i.test(orderError?.message || "");
    return (
      <section className="card-glass mx-auto max-w-xl p-6 sm:p-8" role="alert">
        <p className="eyebrow">Pedidos</p>
        <h1 className="mt-2 text-2xl">{missing ? "Pedido não encontrado" : "Não foi possível carregar este pedido"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {missing ? "Este pedido pode ter sido removido ou o link pode estar incorreto. Confira o número e tente abri-lo novamente pela lista." : (orderError?.message || "Verifique sua conexão e tente carregar os dados outra vez.")}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {!missing ? <Button variant="outline" onClick={() => retryOrder()}>Tentar novamente</Button> : null}
          <Button asChild><Link to="/admin/pedidos">Voltar para pedidos</Link></Button>
        </div>
      </section>
    );
  }

  async function refresh() {
    await Promise.all([
      ["admin-order", orderId], ["admin-order-notices", orderId], ["admin-orders"], ["admin-new-orders"], ["Order"], ["admin-entregas"], ["admin-producao"],
      ["admin-payments"], ["admin-payments-pending"],
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  }

  async function changeStatus(nextStatus = status) {
    if (!nextStatus) return;
    setBusy("status");
    try {
      if (nextStatus === "pagamento_aprovado" && isOnlinePayment(order.payment_method)) {
        const result = await checkProviderPayment({ data: { order_id: order.id } });
        if (result.state === "aprovado") toast.success("Pagamento confirmado");
        else toast.info("Status conferido. A confirmação depende do provedor.");
      } else {
        await updateOrderStatus({ data: { order_id: order.id, status: nextStatus, note } });
        toast.success(nextStatus === "pagamento_aprovado" ? "Pagamento confirmado" : "Status atualizado");
      }
      setNote("");
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Não foi possível alterar o status.");
    } finally {
      setBusy("");
    }
  }

  async function uploadArt(file) {
    if (!file) return;
    setBusy("art");
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setArtUri(file_uri);
      toast.success("Arte anexada ao pedido (não enviada ainda)");
    } catch {
      toast.error("Não foi possível anexar a arte.");
    } finally {
      setBusy("");
    }
  }

  async function registerArt(action) {
    setBusy(action);
    try {
      await setArtApproval({ data: { order_id: order.id, action, note: artNote, art_file_uri: artUri || undefined } });
      toast.success("Registro salvo no histórico");
      setArtNote("");
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Não foi possível registrar.");
    } finally {
      setBusy("");
    }
  }

  function sendWhatsApp() {
    let digits = String(order.customer_phone || "").replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
    if (!digits) {
      toast.warning("O pedido não tem telefone do cliente.");
      return;
    }
    const template = (settings?.wa_template_arte || "Olá! Segue a arte do pedido {pedido}.").replace(/{pedido}/g, order.order_number).replace(/{cliente}/g, order.customer_name);
    const message = artUrl ? `${template}\n\nConfira a arte (link temporário): ${artUrl}` : template;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function download(only, size) {
    setBusy(size ? `zip-size-${size}` : `zip-${only}`);
    try {
      const link = await createDownloadLink({ data: { order_id: order.id, only, size } });
      window.location.href = link.url;
    } catch (error) {
      toast.error(error?.message || "Não foi possível gerar o arquivo.");
    } finally {
      setBusy("");
    }
  }

  async function saveInternalNumber() {
    setSavingNumber(true);
    try {
      const value = String(internalNumber ?? order.internal_number ?? "").trim();
      // Um único número no pedido: o interno passa a ser também o número oficial.
      await base44.entities.Order.update(order.id, {
        internal_number: value,
        ...(value ? { order_number: value } : {}),
        last_action_by: user?.full_name || user?.email || "admin",
        last_action_email: user?.email ?? "",
        last_action_at: new Date().toISOString(),
      });
      setInternalNumber(null);
      toast.success("Número interno salvo");
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar o número interno.");
    } finally {
      setSavingNumber(false);
    }
  }

  const summary = productionSummary({ items, photos });
  const filesReady = itemsReady && photosReady;

  async function exportOrder(kind) {
    if (!filesReady || busy) return;
    setBusy(`pdf-${kind}`);
    try {
      const { buildOrderPdf } = await import("@/lib/admin-order-report");
      const filename = orderLabel(order).replace(/[^\p{L}\p{N}_.-]+/gu, "_").slice(0, 80) || "pedido";
      const suffix = kind === "production" ? "ficha_producao" : "relatorio";
      buildOrderPdf({ order, items, photos, summary, kind }).save(`${filename}_${suffix}.pdf`);
    } catch {
      toast.error("Não foi possível gerar o PDF do pedido. Tente novamente.");
    } finally {
      setBusy("");
    }
  }

  const printPhotos = photos.filter((photo) => photo.print_file_uri);
  const categories = ["revelacao", "polaroid", "magnet", "banner", "personalizado", "moldura"].filter((area) =>
    printPhotos.some((photo) => photo.area === area) ||
    ((area === "banner" || area === "personalizado") && items.some((item) => item.area === area))
  );
  const sizes = Array.from(
    new Set(
      printPhotos
        .filter((photo) => photo.area === "revelacao" || photo.area === "polaroid")
        .map((photo) => sizeLabel(photo))
    )
  ).filter(Boolean);

  return (
    <div>
      <Link to="/admin/pedidos" className="text-xs text-muted-foreground hover:text-foreground">← Voltar para pedidos</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{orderLabel(order)}</p>
          {order.internal_number && order.internal_number !== order.order_number ? (
            <p className="text-[11px] text-muted-foreground">site: {order.order_number}</p>
          ) : null}
          <h1 className="mt-1 text-3xl">{order.customer_name}</h1>
          <p className="text-xs text-muted-foreground">{order.customer_email} · {order.customer_phone} · {formatDate(order.created_date)}</p>
        </div>
        {canDownload ? <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => exportOrder("production")} disabled={!filesReady || Boolean(busy)} className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Ficha de produção</Button>
          <Button size="sm" variant="outline" onClick={() => exportOrder("order")} disabled={!filesReady || Boolean(busy)} className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Relatório PDF</Button>
          <Button size="sm" onClick={() => download("all")} className="gap-1.5">
            {busy === "zip-all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} ZIP completo
          </Button>
        </div> : null}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <OrderHeaderCard order={order} />

          <section className="card-glass p-5">
            <h2 className="text-lg">Itens e fotos</h2>
            {summary.length > 0 && (
              <div className="mt-3 rounded-xl border border-gold/40 bg-gold-soft p-4">
                <h3 className="text-sm font-semibold">Resumo para o envelope</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {summary.map(({ key, count, title }) => (
                    <li key={key} className="break-words"><strong className="tabular-nums">{count}</strong> {title}</li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 border-b border-border/60 pb-2">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-[11px] text-muted-foreground">{item.variant} · {item.area} · {item.qty}x</p>
                    <OrderItemOptions item={item} />
                  </div>
                  <span>{formatBRL(item.line_total)}</span>
                </li>
              ))}
            </ul>
            <OrderPhotoGallery key={orderId} photos={photos} Photo={PhotoRow} className="mt-4 grid gap-2 sm:grid-cols-2" />
            {canDownload ? <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="eyebrow w-full">Baixar separado</span>
              {categories.map((area) => (
                <Button key={area} size="sm" variant="outline" onClick={() => download(area)} disabled={Boolean(busy)}>
                  {busy === `zip-${area}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {AREA_LABELS[area]}
                </Button>
              ))}
              {sizes.map((size) => (
                <Button
                  key={size}
                  size="sm"
                  variant="outline"
                  onClick={() => download("impressao", size)}
                  disabled={Boolean(busy)}
                >
                  {busy === `zip-size-${size}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Só {size}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={() => download("originais")} disabled={Boolean(busy)}>
                Originais
              </Button>
            </div> : null}
          </section>

          <section className="card-glass p-5">
            <h2 className="text-lg">Histórico de status</h2>
            <ol className="mt-3 space-y-2 text-xs">
              {(order.status_history ?? []).map((entry, index) => (
                <li key={index} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                  <span>{STATUS_LABELS[entry.status] || entry.status}{entry.note ? ` — ${entry.note}` : ""}</span>
                  <span className="text-muted-foreground">{formatDate(entry.date)} · {entry.by}</span>
                </li>
              ))}
            </ol>
          </section>

          {notices.length > 0 && <section className="card-glass p-5">
            <h2 className="text-lg">Avisos por e-mail</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {notices.map((entry) => <li key={entry.id}>
                {{payment_approved:"Pagamento aprovado",order_ready:"Pedido pronto",shipped:"Envio registrado"}[entry.kind] || entry.kind}
                {" · "}{entry.status} · {formatDate(entry.updated_at)}
              </li>)}
            </ul>
          </section>}
          {canEditArt ? <section className="card-glass p-5">
            <h2 className="text-lg">Aprovação de arte</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Modo: {order.art_approval_mode} · Situação: {order.art_approval_status} · Cliente pediu aprovação:{" "}
              {order.art_approval_requested ? "sim" : "não"}
            </p>
            {order.art_approval_status === "aprovada" && PRODUCTION_START_STATUSES.includes(order.status) && canProduceOrder(order) && (
              <p className="mt-2 text-xs font-medium">Arte aprovada. Pedido liberado para produção.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-xs">
                {busy === "art" ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : <Upload className="inline h-3.5 w-3.5" />} Anexar arte
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => uploadArt(event.target.files?.[0])} />
              </label>
              <Button size="sm" variant="outline" onClick={sendWhatsApp} className="gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> Enviar pelo WhatsApp</Button>
              <Button size="sm" onClick={() => registerArt("enviada")}>Registrar envio</Button>
              <Button size="sm" variant="outline" onClick={() => registerArt("aprovada")} className="gap-1.5"><Check className="h-3.5 w-3.5" /> Aprovação</Button>
              <Button size="sm" variant="outline" onClick={() => registerArt("ajustes")}>Ajustes solicitados</Button>
            </div>
            <textarea
              value={artNote}
              onChange={(event) => setArtNote(event.target.value)}
              rows={2}
              placeholder="Observação da aprovação (fica no histórico)"
              className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
            />
            <ol className="mt-3 space-y-1 text-[11px] text-muted-foreground">
              {(order.art_history ?? []).map((entry, index) => (
                <li key={index}>{formatDate(entry.date)} · {entry.action} · {entry.by}{entry.note ? ` · ${entry.note}` : ""}</li>
              ))}
            </ol>
          </section> : null}
        </div>

        <aside className="space-y-5">
          {canCollectPayment && awaitsPickupPayment(order) && order.status === "pronto" && (
            <section className="card-glass p-5">
              <h2 className="text-lg">Cobrar na retirada</h2>
              <p className="mt-1 text-sm font-medium">{formatBRL(order.total)} a receber no balcão</p>
              <Button className="mt-3 w-full" onClick={() => changeStatus("pagamento_aprovado")} disabled={Boolean(busy)}>
                Confirmar recebimento
              </Button>
            </section>
          )}

          {STATUS_FLOW.some((value) => canUpdateOrderAsStaff(user, value)) ? <section className="card-glass p-5">
            <h2 className="text-lg">Alterar status</h2>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {STATUS_FLOW.filter((value) => canUpdateOrderAsStaff(user, value)).map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
            </select>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Observação (opcional)"
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <Button onClick={() => changeStatus()} disabled={!status || busy === "status"} className="mt-3 w-full">
              {busy === "status" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar status
            </Button>
            {needsArtApproval(order) && (
              <p className="mt-2 text-[11px] text-amber-700">
                Produção bloqueada até registrar a aprovação da arte.
              </p>
            )}
          </section> : null}

          {canEditDeadline ? <OrderDeadlinePanel order={order} onDone={refresh} /> : null}

          {user?.role === "admin" ? <section className="card-glass p-5">
            <h2 className="text-lg">Número interno</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Número do seu sistema (planilha, PDV, ERP). Ao salvar, ele passa a ser o número do pedido — o número gerado pelo site é
              substituído e não ficam dois números.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={internalNumber ?? order.internal_number ?? ""}
                onChange={(event) => setInternalNumber(event.target.value)}
                placeholder={order.order_number}
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <Button size="sm" onClick={saveInternalNumber} disabled={savingNumber}>
                {savingNumber ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Salvar
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Em uso na produção: <strong>{orderLabel({ ...order, internal_number: internalNumber ?? order.internal_number })}</strong>
            </p>
          </section> : null}

        </aside>
      </div>
    </div>
  );
}
