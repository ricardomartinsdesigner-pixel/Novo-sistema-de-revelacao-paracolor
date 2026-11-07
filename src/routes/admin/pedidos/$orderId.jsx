import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { jsPDF } from "jspdf";
import { Check, Download, FileText, Loader2, MessageCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { useSignedUrl, useSettings } from "@/lib/store";
import { createDownloadLink, setArtApproval, settleQuickDeadlines, updateOrderStatus } from "@/lib/store-fns";
import { STATUS_FLOW, STATUS_LABELS, formatBRL, formatDate } from "@/lib/areas";
import { AREA_LABELS, orderLabel, sizeLabel } from "@/lib/order-paths";
import OrderItemOptions from "@/components/orders/OrderItemOptions";
import OrderHeaderCard from "@/components/admin/OrderHeaderCard";
import OrderDeadlinePanel from "@/components/admin/OrderDeadlinePanel";

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
  const { settings } = useSettings();
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [artUri, setArtUri] = useState("");
  const [artNote, setArtNote] = useState("");
  const [internalNumber, setInternalNumber] = useState(null);
  const [savingNumber, setSavingNumber] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: async () => {
      await settleQuickDeadlines().catch(() => null);
      return base44.entities.Order.get(orderId);
    },
  });
  const { data: items = [] } = useQuery({
    queryKey: ["admin-order-items", orderId],
    queryFn: async () => (await base44.entities.OrderItem.filter({ order_id: orderId }, { limit: 100 })).items ?? [],
  });
  const { data: photos = [] } = useQuery({
    queryKey: ["admin-order-photos", orderId],
    queryFn: async () => (await base44.entities.OrderPhoto.filter({ order_id: orderId }, { limit: 500, sort: "sort" })).items ?? [],
  });

  const artUrl = useSignedUrl(artUri || order?.art_file_uri);

  if (isLoading || !order) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando pedido…</p>;
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
    await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  }

  async function changeStatus() {
    if (!status) return;
    setBusy("status");
    try {
      await updateOrderStatus({ data: { order_id: order.id, status, note } });
      toast.success("Status atualizado");
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

  function productionSheet() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Paracolor — Ficha de produção`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Pedido: ${orderLabel(order)}`, 14, 28);
    doc.text(`Cliente: ${order.customer_name}`, 14, 34);
    doc.text(`Telefone: ${order.customer_phone}`, 14, 40);
    doc.text(`Recebimento: ${order.fulfillment === "entrega" ? `Entrega — ${order.shipping_address}` : "Retirada na loja"}`, 14, 46);
    doc.text(`Status: ${STATUS_LABELS[order.status] || order.status}`, 14, 52);
    doc.text(`Aprovação de arte: ${order.art_approval_status}`, 14, 58);
    let y = 70;
    doc.text("Itens", 14, y);
    y += 6;
    items.forEach((item) => {
      doc.text(`- ${item.product_name} ${item.variant ? `(${item.variant})` : ""} — ${item.qty}x — ${formatBRL(item.line_total)}`, 14, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    y += 4;
    doc.text("Fotos", 14, y);
    y += 6;
    photos.forEach((photo, index) => {
      doc.text(
        `${index + 1}. ${photo.filename || "foto"} | ${photo.size_name} | ${photo.copies || 1} cópia(s) | ${
          photo.fit_mode === "contain" ? "foto inteira" : "preenchida"
        } | ${photo.border ? "com borda" : "sem borda"}${photo.caption ? ` | legenda: ${photo.caption}` : ""}`,
        14,
        y
      );
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    doc.save(`${orderLabel(order)}_ficha_producao.pdf`);
  }

  function orderReport() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Relatório do pedido ${orderLabel(order)}`, 14, 18);
    doc.setFontSize(10);
    const lines = [
      `Cliente: ${order.customer_name}`,
      `E-mail: ${order.customer_email}`,
      `Telefone: ${order.customer_phone}`,
      `CPF: ${order.customer_cpf || "—"}`,
      `Criado em: ${formatDate(order.created_date)}`,
      `Status: ${STATUS_LABELS[order.status] || order.status}`,
      `Pagamento: ${order.payment_status} (${order.payment_method})`,
      `Subtotal: ${formatBRL(order.subtotal)}`,
      `Desconto: ${formatBRL(order.discount || 0)}`,
      `Frete: ${formatBRL(order.shipping_cost || 0)}`,
      `Total: ${formatBRL(order.total)}`,
      `Cupom: ${order.coupon_code || "—"}`,
      `Mensagem de presente: ${order.gift_message || "—"}`,
      `Fotos: ${photos.length}`,
    ];
    lines.forEach((line, index) => doc.text(line, 14, 30 + index * 6));
    doc.save(`${orderLabel(order)}_relatorio.pdf`);
  }

  const printPhotos = photos.filter((photo) => photo.print_file_uri);
  const categories = ["revelacao", "polaroid", "banner", "personalizado", "moldura"].filter((area) =>
    printPhotos.some((photo) => photo.area === area)
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
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={productionSheet} className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Ficha de produção</Button>
          <Button size="sm" variant="outline" onClick={orderReport} className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Relatório PDF</Button>
          <Button size="sm" onClick={() => download("all")} className="gap-1.5">
            {busy === "zip-all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} ZIP completo
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <OrderHeaderCard order={order} items={items} photos={photos} />

          <section className="card-glass p-5">
            <h2 className="text-lg">Itens e fotos</h2>
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
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {photos.map((photo) => <PhotoRow key={photo.id} photo={photo} />)}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
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
            </div>
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

          <section className="card-glass p-5">
            <h2 className="text-lg">Aprovação de arte</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Modo: {order.art_approval_mode} · Situação: {order.art_approval_status} · Cliente pediu aprovação:{" "}
              {order.art_approval_requested ? "sim" : "não"}
            </p>
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
          </section>
        </div>

        <aside className="space-y-5">
          <OrderDeadlinePanel order={order} onDone={refresh} />

          <section className="card-glass p-5">
            <h2 className="text-lg">Alterar status</h2>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {STATUS_FLOW.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
            </select>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Observação (opcional)"
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <Button onClick={changeStatus} disabled={!status || busy === "status"} className="mt-3 w-full">
              {busy === "status" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar status
            </Button>
            {order.art_approval_requested && order.art_approval_status !== "aprovada" && (
              <p className="mt-2 text-[11px] text-amber-700">
                Produção bloqueada até registrar a aprovação da arte.
              </p>
            )}
          </section>

          <section className="card-glass p-5">
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
          </section>

        </aside>
      </div>
    </div>
  );
}