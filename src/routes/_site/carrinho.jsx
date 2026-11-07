import { useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import CartRow from "@/components/cart/CartRow";
import CartUpsell from "@/components/cart/CartUpsell";
import DiscountTrack from "@/components/cart/DiscountTrack";
import { useCart } from "@/lib/cart";
import { useSettings } from "@/lib/store";
import { cartLineTotal } from "@/lib/cart-items";
import { linesFromItems, photoCounts, pricingContext, repriceItems } from "@/lib/quantity-pricing";
import { useQuantityPricing } from "@/hooks/use-quantity-pricing";
import { deadlineFor, formatReadyDate } from "@/lib/deadline";
import { formatBRL } from "@/lib/areas";
import { useAuth } from "@/lib/AuthContext";
import { saveCartLead } from "@/lib/cart-lead-fns";

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
  const { items, ready, photoCount, removeItem, setQty, clear } = useCart();
  const quantityPricing = useQuantityPricing();
  const { settings } = useSettings();
  const { isAuthenticated } = useAuth();
  const saveLead = useServerFn(saveCartLead);

  const counts = useMemo(() => photoCounts(linesFromItems(items)), [items]);
  const pricedItems = useMemo(
    () => repriceItems(items, pricingContext({ ...quantityPricing.data, counts })),
    [items, quantityPricing.data, counts]
  );
  const subtotal = useMemo(
    () => pricedItems.reduce((sum, item) => sum + cartLineTotal(item), 0),
    [pricedItems]
  );
  // Registra o carrinho do cliente para o painel conseguir lembrar quem parou aqui.
  useEffect(() => {
    if (!ready || !isAuthenticated || !items.length) return undefined;
    const timer = setTimeout(() => {
      saveLead({
        data: {
          items: items.slice(0, 50).map((item) => ({
            name: item.title || item.area,
            qty: Number(item.qty) || 1,
            total: cartLineTotal(item),
          })),
          total: subtotal,
        },
      }).catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, [items, ready, isAuthenticated, subtotal, saveLead]);

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: pricedItems.filter((item) => item.area === group.key),
        photoCount: counts[group.key]
          ? Object.values(counts[group.key]).reduce((sum, value) => sum + value, 0)
          : 0,
      })).filter((group) => group.items.length),
    [pricedItems, counts]
  );
  const readyDate = useMemo(
    () => (settings ? deadlineFor(settings, items.map((item) => item.area)) : null),
    [settings, items]
  );

  if (!ready) return <p role="status" className="container-x py-24 text-center text-sm text-muted-foreground">Carregando carrinho…</p>;

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
              return (
                <section key={group.key} className="rounded-[1.25rem] border border-border bg-card px-6 py-4">
                  <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 pb-3">
                    <h2 className="text-lg">{group.label}</h2>
                    <span className="text-xs text-muted-foreground">
                      {group.items.length} item(ns) · {formatBRL(groupTotal)}
                    </span>
                  </header>
                  {group.discount ? (
                    <DiscountTrack category={group.key} count={group.photoCount} tiers={quantityPricing.data.tiers} />
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
                <dd>{formatBRL(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Retirada na loja</dt>
                <dd>Grátis</dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-medium">
              <span>Total</span>
              <span>{formatBRL(subtotal)}</span>
            </div>
            {readyDate ? (
              <p className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
                Previsão de pronto: <strong className="text-foreground">{formatReadyDate(readyDate)}</strong> (considerando horário de produção e feriados)
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Frete e cupom são calculados no checkout. A produção começa após a confirmação do pagamento.
            </p>
            <Button asChild size="lg" className="mt-5 w-full rounded-full">
              <Link to="/checkout">
                Finalizar pedido <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
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
