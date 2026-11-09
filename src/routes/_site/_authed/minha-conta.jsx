import { nextOrderStep } from "@/lib/customer-order";
import MyCoupons from "@/components/account/MyCoupons";
import { listOrderPhotos } from "@/lib/photo-order";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Loader2, LogOut, RotateCcw, Star } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { uid } from "@/lib/uid";
import { useCart } from "@/lib/cart";
import { STATUS_LABELS, formatBRL, formatDate } from "@/lib/areas";
import { useEntityPage } from "@/lib/use-entity-page";
import { isPhotoItem } from "@/lib/cart-items";
import DeleteAccountCard from "@/components/account/DeleteAccountCard";
import { useSettings } from "@/lib/store";

export const Route = createFileRoute("/_site/_authed/minha-conta")({
  head: () => ({ meta: [{ title: "Minha conta — Paracolor" }] }),
  component: AccountPage,
});

function repeatWindowOpen(order, configuredDays, now = Date.now()) {
  if (!["enviado", "retirado", "concluido"].includes(order?.status)) return true;
  const days = Math.max(1, Math.min(730, Math.trunc(Number(configuredDays) || 90)));
  const statusDates = (Array.isArray(order.status_history) ? order.status_history : [])
    .filter((entry) => entry?.status === order.status && entry?.date)
    .map((entry) => Date.parse(entry.date))
    .filter(Number.isFinite);
  const completedAt = statusDates.length
    ? Math.max(...statusDates)
    : Date.parse(order.updated_date || order.created_date || "");
  if (!Number.isFinite(completedAt)) return false;
  return now < completedAt + days * 86_400_000;
}

function AccountPage() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { addItems } = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState({ phone: "", address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setProfile({ phone: user.phone || "", address: user.address || "" });
  }, [user]);

  const { records: orders, isPending: isLoading, error: ordersError, hasNextPage, fetchNextPage, isFetchingNextPage } = useEntityPage("Order", { created_by_id: user.id });
  const hasCompletedOrder = orders.some((order) => order.status === "concluido");
  const googleReviewUrl = (() => {
    try {
      const url = new URL(settings?.google_review_url || "");
      const host = url.hostname.toLowerCase();
      return url.protocol === "https:" && (host === "google.com" || host.endsWith(".google.com") || host === "g.page" || host.endsWith(".g.page") || host === "maps.app.goo.gl") ? url.toString() : "";
    } catch {
      return "";
    }
  })();
  const { data: pendingApproval = 0 } = useQuery({
    queryKey: ["Order", "pending-art", user.id],
    queryFn: () => base44.entities.Order.count({ created_by_id: user.id, art_approval_requested: true, art_approval_status: "aguardando" }),
  });

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await base44.auth.updateMe({ phone: profile.phone, address: profile.address });
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.success("Dados atualizados");
    } catch {
      toast.error("Não foi possível salvar seus dados.");
    } finally {
      setSaving(false);
    }
  }

  async function repeat(order) {
    const items = (await base44.entities.OrderItem.filter({ order_id: order.id }, { limit: 100 })).items ?? [];
    const photos = await listOrderPhotos(base44.entities, order.id);
    const cartItems = items.map((item) => {
      const itemPhotos = photos
        .filter((photo) => photo.item_id === item.id)
        .map((photo) => ({
          filename: photo.filename,
          original_file_uri: photo.original_file_uri,
          print_file_uri: photo.print_file_uri,
          print_name: photo.print_name,
          size_name: photo.size_name,
          width_cm: photo.width_cm,
          height_cm: photo.height_cm,
          fit_mode: photo.fit_mode,
          color_effect: photo.color_effect,
          border: photo.border,
          zoom: photo.zoom,
          offset_x: photo.offset_x,
          offset_y: photo.offset_y,
          rotation: photo.rotation,
          flip_h: photo.flip_h,
          flip_v: photo.flip_v,
          quality: photo.quality,
          alerts: photo.alerts,
          caption: photo.caption,
          caption_style: photo.caption_style,
          captionAreaEnabled: photo.caption_area_enabled !== false,
          caption_area_enabled: photo.caption_area_enabled !== false,
          polaroid_model: photo.polaroid_model,
          copies: photo.copies,
          confirmed_issue: photo.confirmed_issue,
        }));
      return {
        key: uid(),
        area: item.area,
        ref_id: item.product_ref_id,
        title: item.product_name,
        subtitle: item.variant || "",
        unitPrice: isPhotoItem(item) ? item.line_total : item.unit_price,
        qty: isPhotoItem(item) ? 1 : item.qty,
        photos: itemPhotos,
        options: item.options || {},
      };
    });
    if (!addItems(cartItems)) return;
    toast.success("Itens adicionados ao carrinho");
    navigate({ to: "/carrinho" });
  }

  return (
    <div className="container-x py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Área do cliente</p>
          <h1 className="mt-2 text-4xl">Olá, {user?.full_name?.split(" ")[0] || "cliente"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <Button variant="outline" onClick={() => logout()} className="gap-1.5">
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>

      {pendingApproval > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Você tem {pendingApproval} pedido(s) aguardando aprovação de arte. Confira a mensagem no WhatsApp e
          responda para liberar a produção.
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <h2 className="text-2xl">Meus pedidos</h2>
          {isLoading ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
          ) : ordersError ? <p role="alert" className="mt-4 text-sm text-destructive">Não foi possível carregar seus pedidos. Recarregue a página para tentar novamente.</p> : orders.length === 0 ? (
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Você ainda não fez nenhum pedido.
              <div className="mt-4"><Button asChild><Link to="/revelar">Revelar minhas fotos</Link></Button></div>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {orders.map((order) => (
                <li key={order.id} className="rounded-[1.25rem] border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link to="/pedido/$orderId" params={{ orderId: order.id }} className="font-medium hover:text-primary">
                        {order.order_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDate(order.created_date)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{STATUS_LABELS[order.status] || order.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatBRL(order.total)}</p>
                      <p className="text-[11px] text-muted-foreground">pagamento {order.payment_status}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-medium text-primary">{nextOrderStep(order)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/pedido/$orderId" params={{ orderId: order.id }}>Ver detalhes</Link>
                    </Button>
                    {repeatWindowOpen(order, settings?.retention_days) ? (
                      <Button size="sm" variant="ghost" onClick={() => repeat(order)} className="gap-1.5">
                        <RotateCcw className="h-3.5 w-3.5" /> Repetir pedido
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {hasNextPage && <Button variant="outline" disabled={isFetchingNextPage} onClick={() => fetchNextPage()} className="mt-4">{isFetchingNextPage ? "Carregando…" : "Carregar mais pedidos"}</Button>}
        </section>

        <aside className="h-fit space-y-6">
          <div className="rounded-[1.25rem] border border-border bg-card p-6">
          <h2 className="text-lg">Meus dados</h2>
          <form onSubmit={saveProfile} className="mt-4 space-y-4">
            <label className="block text-xs text-muted-foreground">
              WhatsApp / telefone
              <input
                value={profile.phone}
                onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Endereço
              <textarea
                value={profile.address}
                onChange={(event) => setProfile({ ...profile, address: event.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
            </Button>
          </form>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Nome e e-mail são os dados da sua conta de acesso.
          </p>
          </div>

          {hasCompletedOrder && googleReviewUrl ? (
            <section className="rounded-[1.25rem] border border-gold/40 bg-card p-6 shadow-sm" aria-labelledby="google-review-title">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-foreground"><Star className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <h2 id="google-review-title" className="text-lg">Conte como foi sua experiência</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Seu pedido foi concluído. Se quiser, conte no Google como foi sua experiência com a Paracolor. Sua avaliação é opcional.</p>
                  <Button asChild className="mt-4 rounded-full">
                    <a href={googleReviewUrl} target="_blank" rel="noopener noreferrer">
                      Avaliar a Paracolor no Google <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
                </div>
              </div>
            </section>
          ) : null}
          <MyCoupons userId={user.id} />
          <DeleteAccountCard user={user} />
        </aside>
      </div>
    </div>
  );
}
