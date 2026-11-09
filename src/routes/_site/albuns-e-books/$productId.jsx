import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Clock, Image as ImageIcon, Loader2, Ruler, ShieldCheck, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { useSettings } from "@/lib/store";
import { formatBRL } from "@/lib/areas";
import { effectivePrice, promoPrice } from "@/lib/promo";
import { daysForArea } from "@/lib/deadline";
import ProductCustomizer from "@/components/products/ProductCustomizer";

export const Route = createFileRoute("/_site/albuns-e-books/$productId")({
  head: () => ({ meta: [{ title: "Álbum ou book — Paracolor" }] }),
  component: AlbumBookProductPage,
});

function Spec({ icon: Icon, label, value }) {
  if (!value) return null;
  return <div className="flex items-start gap-2.5 rounded-lg bg-secondary/50 px-3 py-2.5"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" /><div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm">{value}</dd></div></div>;
}

function AlbumBookProductPage() {
  const { productId } = Route.useParams();
  const { settings } = useSettings();
  const { isAuthenticated, navigateToLogin } = useAuth();
  const [activeImage, setActiveImage] = useState(0);
  const { data: product, isLoading } = useQuery({
    queryKey: ["album-book", productId],
    queryFn: () => base44.entities.CustomProduct.get(productId),
  });

  if (isLoading) return <div className="container-x flex items-center gap-2 py-24 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando produto…</div>;
  if (!product || product.active === false || !["album", "book"].includes(product.catalog_type)) return <div className="container-x py-24 text-center"><h1 className="text-2xl">Produto não encontrado</h1><Button asChild variant="outline" className="mt-4 rounded-full"><Link to="/albuns-e-books">Voltar para Álbuns e Books</Link></Button></div>;

  const gallery = [product.image, ...(product.images || [])].filter(Boolean);
  const cover = gallery[Math.min(activeImage, Math.max(gallery.length - 1, 0))];
  const price = effectivePrice(product, settings);
  const promo = promoPrice(product, settings);
  const days = product.production_days || daysForArea(settings, "personalizado");
  const kind = product.catalog_type === "book" ? "Book fotográfico" : "Álbum fotográfico";

  return (
    <div>
      <section className="band-gold border-b border-border/70">
        <div className="container-x py-8 sm:py-10">
          <Link to="/albuns-e-books" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Voltar para a vitrine</Link>
          <p className="eyebrow mt-5">{[kind, product.category, product.subcategory].filter(Boolean).join(" · ")}</p>
          <h1 className="mt-2 max-w-3xl text-4xl leading-tight sm:text-5xl">{product.name}</h1>
          {product.short_description ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{product.short_description}</p> : null}
        </div>
      </section>

      <section className="container-x py-8 sm:py-12">
        <div className="grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div>
            <div className="overflow-hidden rounded-[1.25rem] border border-border bg-card paper">
              {cover ? <Image src={cover} alt={`${product.name} — ${activeImage ? `imagem ${activeImage + 1}` : "capa"}`} className="aspect-[4/3] w-full object-cover" fittingType="fill" /> : <div className="grid aspect-[4/3] place-items-center bg-secondary"><BookOpen className="h-12 w-12 text-muted-foreground/50" /></div>}
            </div>
            {gallery.length > 1 ? <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">{gallery.slice(0, 10).map((src, index) => <button key={`${src}-${index}`} type="button" onClick={() => setActiveImage(index)} aria-label={`Ver imagem ${index + 1}`} aria-current={index === activeImage} className={`overflow-hidden rounded-lg border ${index === activeImage ? "border-gold" : "border-border"}`}><Image src={src} alt="" className="aspect-square w-full object-cover" fittingType="fill" /></button>)}</div> : null}
            {product.full_description ? <div className="mt-5 rounded-[1.25rem] border border-border bg-card p-5"><p className="eyebrow">Sobre o produto</p><p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{product.full_description}</p></div> : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[1.25rem] border border-gold/40 bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-end gap-3">
                <span className="font-display text-3xl leading-none">{Number(price) > 0 ? formatBRL(price) : "Preço sob consulta"}</span>
                {promo ? <span className="text-sm text-muted-foreground line-through">{formatBRL(product.price)}</span> : null}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Spec icon={Ruler} label="Tamanho" value={product.album_size} />
                <Spec icon={Sparkles} label="Estilo" value={product.album_style} />
                <Spec icon={ImageIcon} label="Capacidade" value={Number(product.photo_capacity) ? `${product.photo_capacity} fotos` : ""} />
                <Spec icon={BookOpen} label="Páginas" value={Number(product.page_count) ? `${product.page_count} páginas` : ""} />
                <Spec icon={ShieldCheck} label="Capa" value={product.cover_material} />
                <Spec icon={BookOpen} label="Encadernação" value={product.binding} />
                <Spec icon={ImageIcon} label="Tamanho da foto/página" value={product.print_dimensions} />
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-gold-deep" /> Produção em {days} dias úteis</span>
                {product.customizable ? <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-gold-deep" /> Personalize com foto e texto</span> : null}
              </div>
              <div className="mt-6 border-t border-border pt-5">
                {Number(price) <= 0 ? (
                  <div className="rounded-xl bg-secondary/50 p-4 text-center"><p className="text-sm text-muted-foreground">Fale com a equipe para consultar o valor e as opções deste produto.</p><Button asChild className="mt-3 rounded-full"><Link to="/contato">Consultar este produto</Link></Button></div>
                ) : isAuthenticated ? <ProductCustomizer product={product} /> : (
                  <div className="rounded-xl border border-border bg-secondary/40 p-5 text-center"><p className="text-sm text-muted-foreground">Entre na sua conta para escolher as opções e, se disponível, enviar foto ou texto para personalizar a capa.</p><Button className="mt-4 rounded-full" onClick={() => navigateToLogin()}>Entrar para continuar</Button></div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
