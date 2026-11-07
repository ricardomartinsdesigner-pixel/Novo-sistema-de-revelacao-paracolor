import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { useEntityList, useSettings } from "@/lib/store";
import { formatBRL } from "@/lib/areas";
import { effectivePrice, promoPrice } from "@/lib/promo";
import { daysForArea } from "@/lib/deadline";
import { useAreas, useSiteContent } from "@/hooks/use-site-content";

export const Route = createFileRoute("/_site/personalizados/")({
  head: () => ({
    meta: [
      { title: "Produtos personalizados — Paracolor" },
      { name: "description", content: "Canecas, almofadas, porta-retratos e outros produtos com as suas fotos." },
    ],
  }),
  component: PersonalizadosPage,
});

function PersonalizadosPage() {
  const { settings } = useSettings();
  const { content } = useSiteContent();
  const area = useAreas().find((item) => item.key === "personalizados");
  const { data: products = [] } = useEntityList("CustomProduct", { active: true }, { sort: "sort" });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todas");
  const [priceRange, setPriceRange] = useState("todos");

  const categories = useMemo(
    () => ["todas", ...Array.from(new Set(products.map((product) => product.category).filter(Boolean)))],
    [products]
  );

  const filtered = products.filter((product) => {
    if (category !== "todas" && product.category !== category) return false;
    if (query && !`${product.name} ${product.short_description || ""}`.toLowerCase().includes(query.toLowerCase())) return false;
    const price = effectivePrice(product, settings);
    if (priceRange === "ate50" && price > 50) return false;
    if (priceRange === "50a100" && (price < 50 || price > 100)) return false;
    if (priceRange === "acima100" && price < 100) return false;
    return true;
  });

  const hasFilters = Boolean(query) || category !== "todas" || priceRange !== "todos";

  return (
    <div>
      <section className="band-gold border-b border-border/70">
        <div className="container-x grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div>
            <p className="eyebrow">{content["page.personalizados.eyebrow"]}</p>
            <h1 className="mt-3 max-w-xl text-4xl leading-[1.05] sm:text-5xl">
              {content["page.personalizados.title"]}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {content["page.personalizados.text"]}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span>
                Produção em <strong className="text-foreground">{daysForArea(settings, "personalizado")} dias úteis</strong>
              </span>
              {products.length ? <span>· {products.length} produto(s) no catálogo</span> : null}
            </div>
          </div>

          {content["page.personalizados.image"] || area?.image ? (
            <Image
              src={content["page.personalizados.image"] || area?.image}
              alt="Produtos personalizados com fotos"
              className="aspect-[4/3] w-full rounded-[1.25rem] object-cover paper"
              fittingType="fill"
            />
          ) : null}
        </div>
      </section>

      <section className="container-x py-10 sm:py-14">
        <div className="rounded-[1.25rem] border border-border bg-card p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar produto"
                className="w-full rounded-full border border-input bg-background py-2.5 pl-10 pr-4 text-sm"
              />
            </div>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-full border border-input bg-background px-4 py-2.5 text-sm sm:w-auto"
            >
              {categories.map((item) => (
                <option key={item} value={item}>{item === "todas" ? "Todas as categorias" : item}</option>
              ))}
            </select>
            <select
              value={priceRange}
              onChange={(event) => setPriceRange(event.target.value)}
              className="w-full rounded-full border border-input bg-background px-4 py-2.5 text-sm sm:w-auto"
            >
              <option value="todos">Qualquer preço</option>
              <option value="ate50">Até R$ 50</option>
              <option value="50a100">R$ 50 a R$ 100</option>
              <option value="acima100">Acima de R$ 100</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-[1.25rem] border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhum produto encontrado com esses filtros.</p>
            {hasFilters ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 rounded-full"
                onClick={() => {
                  setQuery("");
                  setCategory("todas");
                  setPriceRange("todos");
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => {
              const price = effectivePrice(product, settings);
              const promo = promoPrice(product, settings);
              return (
                <article
                  key={product.id}
                  className="card-hover group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-border bg-card"
                >
                  <Link
                    to="/personalizados/$productId"
                    params={{ productId: product.id }}
                    className="relative block aspect-[4/3] overflow-hidden bg-secondary"
                  >
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        fittingType="fill"
                      />
                    ) : null}
                    {promo ? (
                      <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-primary-foreground">
                        promo
                      </span>
                    ) : null}
                  </Link>

                  <div className="flex flex-1 flex-col p-5">
                    {product.category ? (
                      <p className="text-[10px] uppercase tracking-[0.18em] text-gold-deep">{product.category}</p>
                    ) : null}
                    <h2 className="mt-1.5 text-xl leading-snug">{product.name}</h2>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {product.short_description}
                    </p>

                    <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                      <div>
                        {promo ? (
                          <p className="text-xs text-muted-foreground line-through">{formatBRL(product.price)}</p>
                        ) : null}
                        <p className="font-display text-2xl leading-none">{formatBRL(price)}</p>
                      </div>
                      <Button asChild size="sm" className="rounded-full">
                        <Link to="/personalizados/$productId" params={{ productId: product.id }}>
                          Personalizar
                        </Link>
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {products.length ? (
          <div className="mt-12 flex flex-col items-start gap-4 rounded-[1.25rem] bg-secondary/60 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-gold-deep" strokeWidth={1.4} />
              <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                Quer um produto que não está na lista? A gente produz sob encomenda com a sua foto e a sua ideia.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/contato">Falar com a equipe</Link>
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}