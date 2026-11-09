import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import CartRow from "@/components/cart/CartRow";
import CartUpsell from "@/components/cart/CartUpsell";
import TierProgress from "@/components/studio/TierProgress";
import { selectedCoupon, useCart } from "@/lib/cart";
import { useEntityList, useSettings } from "@/lib/store";
import { cartLineTotal, checkoutItems } from "@/lib/cart-items";
import { linesFromItems, photoCounts, pricingContext, repriceItems } from "@/lib/quantity-pricing";
import { useQuantityPricing } from "@/hooks/use-quantity-pricing";
import { deadlineFor, formatReadyDate } from "@/lib/deadline";
import { formatBRL } from "@/lib/areas";
import { useAuth } from "@/lib/AuthContext";
import { getPublicCampaigns } from "@/lib/campaign-fns";
import { quoteCartCampaign } from "@/lib/store-fns";
import { saveCartLead } from "@/lib/cart-lead-fns";
import { publicPageEnabled } from "@/lib/public-pages";

export const Route = createFileRoute("/_site/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Paracolor" },
      { name: "description", content: "Revise as fotos, polaroids, banners e produtos do seu pedido antes de finalizar na Paracolor." },
    ],
  }),
  component: CartPage,
});

const GROUPS = [
  { key: "revelacao", label: "Revelação", discount: true },
  { key: "polaroid", label: "Polaroides", discount: true },
  { key: "banner", label: "Banners" },
  { key: "personalizado", label: "Personalizados" },
  { key: "moldura", label: "Molduras" },
];

function CartPage() {
  const { items, ready, checkoutKey, photoCount, removeItem, setQty, clear, campaignCoupon, chooseCoupon } = useCart();
  const hasRevelation = items.some((item) => item.area === "revelacao");
  const quantityPricing = useQuantityPricing(hasRevelation);
  const revealSizes = useEntityList("PhotoSize", { active: true }, { sort: "sort", limit: 1000 });
  const { settings } = useSettings();
  const { isAuthenticated, user } = useAuth();
  const coupon = selectedCoupon(campaignCoupon, user?.id);
  const { data: campaigns } = useQuery({
    queryKey: ["public-campaigns"],
    queryFn: () => getPublicCampaigns(),
    enabled: ready && Boolean(items.length) && !coupon,
    refetchInterval: 30_000,
  });
  const { data: estimate, error: offerError } = useQuery({
    queryKey: ["cart-campaign", user?.id, checkoutKey, coupon],
    enabled: ready && Boolean(items.length) && Boolean(coupon || campaigns?.automatic),
    refetchInterval: 30_000,
    queryFn: () => quoteCartCampaign({ data: { items: checkoutItems(items), fulfillment: "retirada", coupon_code: coupon } }),
    retry: false,
  });
  const offer = coupon || campaigns?.automatic ? estimate : null;
  const saveLead = useServerFn(saveCartLead);

  const photoLines = useMemo(() => linesFromItems(items), [items]);
  const counts = useMemo(() => photoCounts(photoLines), [photoLines]);
  const mixedCopies = counts.revelacao && counts.polaroid && Object.keys(counts.revelacao).length && Object.keys(counts.polaroid).length
    ? photoLines.reduce((total, line) => total + line.copies, 0) : 0;
  const pricedItems = useMemo(
    () => repriceItems(items, pricingContext({ ...quantityPricing.data, counts }), revealSizes.data),
    [items, quantityPricing.data, counts, revealSizes.data]
  );
  const subtotal = useMemo(
    () => pricedItems.reduce((sum, item) => sum + cartLineTotal(item), 0),
    [pricedItems]
  );
  // Registra o carrinho do cliente para o painel conseguir lembrar quem parou aqui.
  useEffect(() => {
    if (!ready || !isAuthenticated || !pricedItems.length || quantityPricing.isLoading || quantityPricing.professionalError) return undefined;
    const timer = setTimeout(() => {
      saveLead({
        data: {
          items: pricedItems.slice(0, 50).map((item) => ({
            name: item.title || item.area,
            qty: Number(item.qty) || 1,
            total: cartLineTotal(item),
          })),
          total: subtotal,
        },
      }).catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, [pricedItems, ready, isAuthenticated, subtotal, saveLead, quantityPricing.isLoading, quantityPricing.professionalError]);

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: pricedItems.filter((item) => item.area === group.key),
      })).filter((group) => group.items.length),
    [pricedItems]
  );
  const readyDate = useMemo(
    () => (settings ? deadlineFor(settings, items.map((item) => item.area)) : null),
    [settings, items]
  );

  if (!ready || (hasRevelation && (quantityPricing.isLoading || revealSizes.isLoading))) {
    return <p role="status" className="container-x py-24 text-center text-sm text-muted-foreground">Conferindo os preços do carrinho…</p>;
  }
  if (quantityPricing.professionalError) {
    return <div className="container-x py-12"><Button variant="outline" onClick={() => quantityPricing.retryProfessional()}>Tentar carregar preços da conta</Button></div>;
  }

  return (
    <div className="container-x py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Seu pedido</p>
          <h1 className="mt-2 text-4xl">Carrinho</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {items.length} item(ns) · {photoCount} foto(s)
          </p>
        </div>
        {items.length > 0 && (
          <button type="button" onClick={clear} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" /> Limpar carrinho
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded-[1.25rem] border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-2xl">Seu carrinho está vazio</h2>
          <p className="mt-2 text-sm text-muted-foreground">Comece pelas fotos, pelas polaroids ou pelos banners.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-full"><Link to="/revelar">Revelar fotos</Link></Button>
            <Button asChild variant="outline" className="rounded-full"><Link to="/polaroids">Polaroids</Link></Button>
            <Button asChild variant="outline" className="rounded-full"><Link to="/banners">Banners</Link></Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-5">
            {groups.map((group) => {
              const groupTotal = group.items.reduce((sum, item) => sum + cartLineTotal(item), 0);
              const pricing = group.key === "revelacao" && quantityPricing.data.professional
                ? quantityPricing.data.professional
                : quantityPricing.data;
              return (
                <section key={group.key} className="rounded-[1.25rem] border border-border bg-card px-6 py-4">
                  <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 pb-3">
                    <h2 className="text-lg">{group.label}</h2>
                    <span className="text-xs text-muted-foreground">
                      {group.items.length} item(ns) · {formatBRL(groupTotal)}
                    </span>
                  </header>
                  {group.discount ? (
                    <TierProgress area={group.key} lines={photoLines.filter((line) => line.area === group.key)} tiers={pricing.tiers} groups={pricing.groups} mixedCopies={group.key === "revelacao" && quantityPricing.data.professional ? 0 : mixedCopies} />
                  ) : null}
                  {group.items.map((item) => (
                    <CartRow key={item.key} item={item} onRemove={removeItem} onQty={setQty} />
                  ))}
                </section>
              );
            })}
          </div>

          <aside className="h-fit rounded-[1.25rem] border border-border bg-card p-6">
            <h2 className="text-xl">Resumo</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatBRL(offer?.subtotal ?? subtotal)}</dd>
              </div>
              {offer?.discount > 0 && <div className="flex justify-between gap-2 text-primary">
                <dt>Desconto · {offer.label}</dt><dd>−{formatBRL(offer.discount)}</dd>
              </div>}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Retirada na loja</dt>
                <dd>Grátis</dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-medium">
              <span>Total</span>
              <span>{formatBRL((offer?.subtotal ?? subtotal) - (offer?.discount ?? 0))}</span>
            </div>
            {coupon && <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <span>Cupom selecionado <strong>{coupon}</strong></span>
              <Button type="button" size="sm" variant="ghost" onClick={() => chooseCoupon("")}>Remover cupom</Button>
            </div>}
            {coupon && offerError && <p role="alert" className="mt-1 text-xs text-destructive">{offerError.message}</p>}
            {readyDate ? (
              <p className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
                Previsão de pronto: <strong className="text-foreground">{formatReadyDate(readyDate)}</strong> (considerando horário de produção e feriados)
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Frete, cupom e formas de pagamento são conferidos no checkout.
            </p>
            {publicPageEnabled(settings, "page_checkout") ? (
              <Button asChild size="lg" className="mt-5 w-full rounded-full">
                <Link to="/checkout">
                  Finalizar pedido <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <p role="status" className="mt-5 rounded-lg border border-border bg-secondary/50 px-3 py-3 text-center text-sm text-muted-foreground">A finalização de pedidos está temporariamente indisponível.</p>
            )}
            <Link to="/revelar" className="mt-3 block text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
              Continuar escolhendo fotos
            </Link>
          </aside>
        </div>
      )}

      <CartUpsell hasPolaroid={groups.some((group) => group.key === "polaroid")} />
    </div>
  );
}
