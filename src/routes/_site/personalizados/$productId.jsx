import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Loader2, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import ProductCustomizer from "@/components/products/ProductCustomizer";
import { formatBRL } from "@/lib/areas";
import { useSettings } from "@/lib/store";
import { effectivePrice, promoPrice } from "@/lib/promo";
import { daysForArea } from "@/lib/deadline";

export const Route = createFileRoute("/_site/personalizados/$productId")({
  head: () => ({ meta: [{ title: "Produto personalizado — Paracolor" }] }),
  component: ProductPage,
});

function ProductPage() {
  const { productId } = Route.useParams();
  const { isAuthenticated, navigateToLogin } = useAuth();
  const { settings } = useSettings();
  const [active, setActive] = useState(0);
  const { data: product, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => base44.entities.CustomProduct.get(productId),
  });

  if (isLoading) {
    return <div className="container-x flex items-center gap-2 py-24 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando produto…</div>;
  }
  if (!product) {
    return <div className="container-x py-24 text-center text-sm text-muted-foreground">Produto não encontrado.</div>;
  }

  const gallery = [product.image, ...(product.images ?? [])].filter(Boolean);
  const cover = gallery[Math.min(active, Math.max(0, gallery.length - 1))];
  const price = effectivePrice(product, settings);
  const promo = promoPrice(product, settings);
  const days = product.production_days || daysForArea(settings, "personalizado");

  return (
    <div>
      <section className="band-gold border-b border-border/70">
        <div className="container-x py-8 sm:py-10">
          <Link to="/personalizados" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a loja
          </Link>
          <p className="eyebrow mt-5">{product.category || "Personalizado"}</p>
          <h1 className="mt-2 max-w-3xl text-4xl leading-[1.08] sm:text-5xl">{product.name}</h1>
          {product.short_description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{product.short_description}</p>
          ) : null}
        </div>
      </section>

      <section className="container-x py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div>
            <div className="overflow-hidden rounded-[1.25rem] border border-border bg-card paper">
              {cover ? (
                <Image src={cover} alt={product.name} className="aspect-square w-full object-cover" fittingType="fill" />
              ) : (
                <div className="aspect-square w-full bg-secondary" />
              )}
            </div>
            {gallery.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-2.5 sm:gap-3">
                {gallery.slice(0, 8).map((src, position) => (
                  <button
                    key={`${src}-${position}`}
                    type="button"
                    onClick={() => setActive(position)}
                    aria-label={`Ver imagem ${position + 1}`}
                    aria-current={position === active}
                    className={`overflow-hidden rounded-lg border transition ${
                      position === active ? "border-gold" : "border-border hover:border-gold/60"
                    }`}
                  >
                    <Image src={src} alt={product.name} className="aspect-square w-full object-cover" fittingType="fill" />
                  </button>
                ))}
              </div>
            ) : null}

            {product.full_description ? (
              <div className="mt-6 rounded-[1.25rem] border border-border bg-card p-5">
                <p className="eyebrow">Detalhes do produto</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {product.full_description}
                </p>
              </div>
            ) : null}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[1.25rem] border border-gold/40 bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-end gap-3">
                <span className="font-display text-4xl leading-none">{formatBRL(price)}</span>
                {promo ? <span className="text-sm text-muted-foreground line-through">{formatBRL(product.price)}</span> : null}
                {promo ? (
                  <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-primary-foreground">
                    promo
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-gold-deep" /> Produção em {days} dias úteis
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-gold-deep" /> Arte conferida antes de imprimir
                </span>
              </div>

              <div className="mt-6">
                {isAuthenticated ? (
                  <ProductCustomizer product={product} />
                ) : (
                  <div className="rounded-xl border border-border bg-secondary/40 p-5 text-center">
                    <p className="text-sm text-muted-foreground">
                      Entre na sua conta para enviar fotos e personalizar este produto.
                    </p>
                    <Button className="mt-4 rounded-full" onClick={() => navigateToLogin()}>
                      Entrar para personalizar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}