import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { useSiteContent } from "@/hooks/use-site-content";
import { useEntityList, useSettings, moduleEnabled } from "@/lib/store";
import { formatBRL } from "@/lib/areas";
import { effectivePrice, promoPrice } from "@/lib/promo";

export const Route = createFileRoute("/_site/albuns-e-books/")({
  head: () => ({ meta: [
    { title: "Álbuns e Books — Paracolor" },
    { name: "description", content: "Conheça os álbuns e books da Paracolor. Escolha o formato e personalize a capa com suas fotos e textos." },
  ] }),
  component: AlbumsBooksPage,
});

function AlbumsBooksPage() {
  const { content } = useSiteContent();
  const { settings } = useSettings();
  const { data: catalog = [], isPending } = useEntityList("CustomProduct", { active: true }, { sort: "sort", limit: 1000 });
  const products = catalog.filter((product) => ["album", "book"].includes(product.catalog_type));
  const [type, setType] = useState("todos");
  const [category, setCategory] = useState("todas");
  const [search, setSearch] = useState("");
  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [products]);
  const filtered = products.filter((product) => {
    if (type !== "todos" && product.catalog_type !== type) return false;
    if (category !== "todas" && product.category !== category) return false;
    const text = [product.name, product.category, product.subcategory, product.short_description, product.album_style].filter(Boolean).join(" ").toLocaleLowerCase();
    return text.includes(search.trim().toLocaleLowerCase());
  });

  if (!moduleEnabled(settings, "albuns_books")) {
    return <section className="container-x py-24 text-center"><h1 className="text-3xl">Vitrine temporariamente indisponível</h1><p className="mt-2 text-sm text-muted-foreground">Fale com a equipe para conhecer os álbuns e books.</p></section>;
  }

  return (
    <div>
      <section className="band-gold border-b border-border/70">
        <div className="container-x grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div>
            <p className="eyebrow">Vitrine Paracolor</p>
            <h1 className="mt-3 max-w-3xl text-4xl leading-tight sm:text-5xl">Álbuns e Books</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Reúna suas melhores lembranças em um álbum ou book feito para durar. Alguns modelos permitem personalizar a capa com sua foto e uma mensagem especial.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-gold/45 bg-card/70 px-3 py-1.5">Adulto</span>
              <span className="rounded-full border border-gold/45 bg-card/70 px-3 py-1.5">Infantil e bebê</span>
              <span className="rounded-full border border-gold/45 bg-card/70 px-3 py-1.5">Casamento e família</span>
              <span className="rounded-full border border-gold/45 bg-card/70 px-3 py-1.5">Books fotográficos</span>
            </div>
          </div>
          {content["page.albuns_books.image"] ? (
            <Image
              src={content["page.albuns_books.image"]}
              alt={content["page.albuns_books.image_alt"] || "Álbuns e books fotográficos da Paracolor"}
              className="aspect-[4/3] w-full rounded-[1.25rem] object-cover paper"
              fittingType="fill"
            />
          ) : (
            <div className="grid aspect-[4/3] w-full place-items-center rounded-[1.25rem] border border-dashed border-gold/45 bg-card/60 text-muted-foreground">
              <BookOpen className="h-12 w-12 text-gold-deep/70" aria-hidden="true" />
            </div>
          )}
        </div>
      </section>

      <section className="container-x py-8 sm:py-12">
        <div className="rounded-[1.25rem] border border-border bg-card p-3 sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <label className="relative">
              <span className="sr-only">Buscar álbuns e books</span>
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar álbum, book ou categoria" className="w-full rounded-full border border-input bg-background py-2.5 pl-10 pr-4 text-sm" />
            </label>
            <div className="flex rounded-full border border-border bg-secondary/50 p-1" aria-label="Filtrar por tipo">
              {[{ key: "todos", label: "Todos" }, { key: "album", label: "Álbuns" }, { key: "book", label: "Books" }].map((option) => (
                <button key={option.key} type="button" onClick={() => setType(option.key)} aria-pressed={type === option.key}
                  className={`rounded-full px-3 py-2 text-xs transition ${type === option.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {option.label}
                </button>
              ))}
            </div>
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar por categoria" className="rounded-full border border-input bg-background px-4 py-2.5 text-sm">
              <option value="todas">Todas as categorias</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        {isPending ? <p className="py-16 text-center text-sm text-muted-foreground">Carregando a vitrine…</p> : filtered.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => {
              const price = effectivePrice(product, settings);
              const promo = promoPrice(product, settings);
              const label = product.catalog_type === "book" ? "Book" : "Álbum";
              return (
                <article key={product.id} className="card-hover flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-border bg-card">
                  <Link to="/albuns-e-books/$productId" params={{ productId: product.id }} className="relative block aspect-[4/3] overflow-hidden bg-secondary">
                    {product.image ? <Image src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]" fittingType="fill" /> : <div className="grid h-full place-items-center"><BookOpen className="h-10 w-10 text-muted-foreground/50" /></div>}
                    <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">{label}</span>
                    {product.customizable ? <span className="absolute right-3 top-3 rounded-full bg-gold px-3 py-1 text-[10px] font-semibold text-gold-foreground">Capa personalizável</span> : null}
                  </Link>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gold-deep">{[product.category, product.subcategory].filter(Boolean).join(" · ") || label}</p>
                    <h2 className="mt-1.5 text-xl leading-snug">{product.name}</h2>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{product.short_description}</p>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {product.album_size ? <span>{product.album_size}</span> : null}
                      {Number(product.photo_capacity) > 0 ? <span>Até {product.photo_capacity} fotos</span> : null}
                      {product.album_style ? <span>{product.album_style}</span> : null}
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                      <div>{promo ? <p className="text-xs text-muted-foreground line-through">{formatBRL(product.price)}</p> : null}
                        <p className="font-display text-xl">{Number(price) > 0 ? formatBRL(price) : "Sob consulta"}</p>
                      </div>
                      <Button asChild size="sm" className="rounded-full"><Link to="/albuns-e-books/$productId" params={{ productId: product.id }}>{product.customizable ? <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ver e personalizar</> : "Ver detalhes"}</Link></Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-[1.25rem] border border-dashed border-border bg-card p-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-gold-deep" />
            <h2 className="mt-3 text-xl">{products.length ? "Não encontramos esse produto" : "Novidades em breve"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{products.length ? "Tente outra busca ou categoria." : "Estamos preparando a vitrine de álbuns e books da Paracolor."}</p>
            {products.length ? <Button variant="outline" className="mt-4 rounded-full" onClick={() => { setSearch(""); setCategory("todas"); setType("todos"); }}>Limpar filtros</Button> : null}
          </div>
        )}
      </section>
    </div>
  );
}
