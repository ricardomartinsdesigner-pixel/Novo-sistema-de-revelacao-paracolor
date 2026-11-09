import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImagePlus, MessageCircle, Ruler, ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { useCart } from "@/lib/cart";
import { useEntityList, useSettings, moduleEnabled } from "@/lib/store";
import { uid } from "@/lib/uid";
import { useAuth } from "@/lib/AuthContext";
import { formatBRL } from "@/lib/areas";
import { useSiteContent } from "@/hooks/use-site-content";

export const Route = createFileRoute("/_site/molduras")({
  head: () => ({
    meta: [
      { title: "Molduras — Paracolor" },
      { name: "description", content: "Vitrine de molduras para dar acabamento e presença às suas fotos favoritas." },
    ],
  }),
  component: MoldurasPage,
});

const MODE_LABEL = {
  exposicao: "Em exposição",
  consulta: "Sob consulta",
  compra: "Compra online",
};

function MoldurasPage() {
  const { data: frames = [], isLoading } = useEntityList("Frame", { active: true }, { sort: "sort" });
  const { settings } = useSettings();
  const { content } = useSiteContent();
  const { addItems } = useCart();
  const { isAuthenticated, navigateToLogin } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("todas");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [subcategoryFilter, setSubcategoryFilter] = useState("todas");
  const onlineEnabled = moduleEnabled(settings, "molduras_online");

  const materials = ["todas", ...Array.from(new Set(frames.map((frame) => frame.material).filter(Boolean)))];
  const categories = ["todas", ...Array.from(new Set(frames.map((frame) => frame.category).filter(Boolean)))];
  const subcategories = ["todas", ...Array.from(new Set(frames.filter((frame) => categoryFilter === "todas" || frame.category === categoryFilter).map((frame) => frame.subcategory).filter(Boolean)))];
  const visible = frames.filter((frame) =>
    (filter === "todas" || frame.material === filter) &&
    (categoryFilter === "todas" || frame.category === categoryFilter) &&
    (subcategoryFilter === "todas" || frame.subcategory === subcategoryFilter)
  );
  const highlights = Array.from(new Set(frames.map((frame) => frame.material).filter(Boolean))).slice(0, 3);

  function buy(frame) {
    if (!isAuthenticated) {
      navigateToLogin();
      return;
    }
    if (!addItems([
      {
        key: uid(),
        area: "moldura",
        ref_id: frame.id,
        title: frame.name,
        subtitle: [frame.color, frame.material].filter(Boolean).join(" · "),
        unitPrice: Number(frame.price) || 0,
        qty: 1,
        photos: [],
        options: { preview_uri: frame.image || "" },
      },
    ])) return;
    toast.success("Moldura adicionada ao carrinho");
  }

  return (
    <div>
      <section className="band-gold border-b border-border/70">
        <div className="container-x py-12 sm:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="eyebrow">{content["page.molduras.eyebrow"]}</p>
              <h1 className="mt-3 text-4xl leading-[1.05] sm:text-5xl">{content["page.molduras.title"]}</h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {content["page.molduras.text"]}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="gap-2 rounded-full"
                  onClick={() => {
                    const digits = String(settings?.whatsapp || "").replace(/\D/g, "");
                    if (!digits) {
                      navigate({ to: "/contato" });
                      return;
                    }
                    window.open(
                      `https://wa.me/${digits}?text=${encodeURIComponent("Olá! Gostaria de um orçamento de moldura.")}`,
                      "_blank"
                    );
                  }}
                >
                  <MessageCircle className="h-4 w-4" /> Pedir orçamento
                </Button>
                {frames.length ? (
                  <span className="text-xs text-muted-foreground">
                    {frames.length} modelo(s) · {materials.length - 1} material(is)
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              <figure className="overflow-hidden rounded-[1.25rem] border border-gold/40 bg-card/80 p-2 shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[0.9rem] bg-secondary/60">
                  {content["page.molduras.sample_image"] ? (
                    <Image src={content["page.molduras.sample_image"]} alt={content["page.molduras.sample_image_alt"] || "Exemplo de foto emoldurada da Paracolor"} className="h-full w-full object-cover" fittingType="fill" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                      <ImagePlus className="h-8 w-8 text-gold-deep/70" strokeWidth={1.4} />
                      <span className="font-display text-lg">Foto de amostra</span>
                    </div>
                  )}
                </div>
              </figure>
              <div className="hidden rounded-[1.25rem] border border-gold/40 bg-card/80 p-6 lg:block">
              <Sparkles className="h-5 w-5 text-gold-deep" strokeWidth={1.4} />
              <p className="mt-3 font-display text-xl leading-snug">Acabamento sob medida para a sua foto</p>
              <ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Ruler className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-deep" /> Consulte medidas e materiais disponíveis
                </li>
                <li className="flex items-start gap-2">
                  <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-deep" /> Atendimento direto para escolher o modelo
                </li>
                <li className="flex items-start gap-2">
                  <ShoppingBag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-deep" /> Modelos liberados podem ser comprados pelo site
                </li>
              </ul>
              {highlights.length ? (
                <p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-gold-deep">
                  {highlights.join(" · ")}
                </p>
              ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-x py-10 sm:py-14">
        {categories.length > 1 ? (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setSubcategoryFilter("todas"); }} className="w-full rounded-full border border-input bg-background px-4 py-2.5 text-sm">
              {categories.map((category) => <option key={category} value={category}>{category === "todas" ? "Todas as categorias" : category}</option>)}
            </select>
            <select value={subcategoryFilter} onChange={(event) => setSubcategoryFilter(event.target.value)} className="w-full rounded-full border border-input bg-background px-4 py-2.5 text-sm">
              {subcategories.map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory === "todas" ? "Todas as subcategorias" : subcategory}</option>)}
            </select>
          </div>
        ) : null}
        {materials.length > 1 ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
            {materials.map((material) => (
              <button
                key={material}
                type="button"
                onClick={() => setFilter(material)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition ${
                  filter === material
                    ? "border-primary bg-accent text-primary"
                    : "border-gold/55 bg-gold-soft/45 text-foreground hover:border-gold"
                }`}
              >
                {material === "todas" ? "Todas" : material}
              </button>
            ))}
          </div>
        ) : null}

        {isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Carregando molduras…</p>
        ) : visible.length ? (
          <div className="mt-4 grid gap-5 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((frame) => (
              <article
                key={frame.id}
                className="card-hover group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-border bg-card"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                  {frame.image ? (
                    <Image
                      src={frame.image}
                      alt={frame.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      fittingType="fill"
                    />
                  ) : null}
                  <span className="absolute left-3 top-3 rounded-full border border-gold/50 bg-background/90 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-foreground backdrop-blur">
                    {frame.mode === "compra" && (!onlineEnabled || !frame.price) ? "Sob consulta" : MODE_LABEL[frame.mode] || "Sob consulta"}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl leading-snug">{frame.name}</h2>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        {[frame.category, frame.subcategory, frame.code, frame.color, frame.material].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {frame.price ? (
                      <span className="whitespace-nowrap font-display text-lg">{formatBRL(frame.price)}</span>
                    ) : null}
                  </div>

                  {frame.description ? (
                    <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {frame.description}
                    </p>
                  ) : null}

                  <p className="mt-3 text-[11px] text-muted-foreground">
                    <span className="text-foreground">Tamanhos:</span> {frame.sizes || "sob consulta"}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    <Button size="sm" variant="outline" onClick={() => navigate({ to: "/contato", search: { moldura: frame.id } })} className="gap-1.5 rounded-full">
                      <MessageCircle className="h-3.5 w-3.5" /> Consultar
                    </Button>
                    {onlineEnabled && frame.mode === "compra" && frame.price ? (
                      <Button size="sm" onClick={() => buy(frame)} className="rounded-full">
                        Comprar
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[1.25rem] border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {frames.length ? "Nenhuma moldura com esses filtros." : "Nenhuma moldura cadastrada ainda."}
            </p>
            {frames.length ? (
              <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => { setFilter("todas"); setCategoryFilter("todas"); setSubcategoryFilter("todas"); }}>
                Ver todas
              </Button>
            ) : null}
          </div>
        )}

        {frames.length ? (
          <div className="mt-12 flex flex-col items-start gap-4 rounded-[1.25rem] bg-secondary/60 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              {content["page.molduras.note"]}
            </p>
            <Button
              variant="outline"
              className="gap-2 rounded-full"
              onClick={() => navigate({ to: "/contato" })}
            >
              <MessageCircle className="h-4 w-4" /> Falar com a equipe
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
