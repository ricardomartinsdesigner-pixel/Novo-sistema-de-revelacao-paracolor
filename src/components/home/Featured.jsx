import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import { moduleEnabled, useEntityList, useSettings } from "@/lib/store";
import { effectivePrice, promoPrice } from "@/lib/promo";
import { useSiteContent } from "@/hooks/use-site-content";
import { formatBRL } from "@/lib/areas";

function Card({ image, label, name, text, price, oldPrice, to, params }) {
  return (
    <Link
      to={to}
      params={params}
      className="group card-hover elev-1 overflow-hidden rounded-[1.25rem] border border-border/80 bg-card"
    >
      <div className="overflow-hidden">
        {image ? (
          <Image
            src={image}
            alt={name}
            className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.04]"
            fittingType="fill"
          />
        ) : (
          <div className="aspect-[4/3] w-full bg-secondary" />
        )}
      </div>
      <div className="p-6">
        <p className="eyebrow">{label}</p>
        <div className="mt-2 flex items-start justify-between gap-2">
          <h3 className="text-2xl leading-tight">{name}</h3>
          <ArrowUpRight className="mt-1 h-5 w-5 flex-none text-muted-foreground transition group-hover:text-primary" strokeWidth={1.5} />
        </div>
        {text ? <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{text}</p> : null}
        {price ? (
          <p className="mt-4 flex items-end gap-2">
            {oldPrice ? <span className="text-xs text-muted-foreground line-through">{formatBRL(oldPrice)}</span> : null}
            <span className="font-display text-xl">{formatBRL(price)}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export default function Featured() {
  const { settings } = useSettings();
  const { content } = useSiteContent();
  const { data: catalogProducts = [] } = useEntityList("CustomProduct", { active: true, featured: true }, { sort: "sort", limit: 20 });
  const products = catalogProducts.filter((product) => !["album", "book"].includes(product.catalog_type)).slice(0, 3);
  const { data: frames = [] } = useEntityList("Frame", { active: true, featured: true }, { sort: "sort", limit: 2 });

  if (!moduleEnabled(settings, "destaques")) return null;
  if (!products.length && !frames.length) return null;

  return (
    <section className="border-t border-border/70 py-20">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-lg">
            <p className="eyebrow">{content["home.featured.eyebrow"]}</p>
            <h2 className="mt-3 text-4xl leading-tight">{content["home.featured.title"]}</h2>
          </div>
          <Link to="/personalizados" className="text-sm font-medium text-primary">
            Ver todos os produtos →
          </Link>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const promo = promoPrice(product, settings);
            return (
              <Card
                key={product.id}
                image={product.image}
                label={product.category || "Personalizado"}
                name={product.name}
                text={product.short_description}
                price={effectivePrice(product, settings)}
                oldPrice={promo ? product.price : 0}
                to="/personalizados/$productId"
                params={{ productId: product.id }}
              />
            );
          })}
          {frames.map((frame) => (
            <Card
              key={frame.id}
              image={frame.image}
              label="Moldura"
              name={frame.name}
              text={[frame.color, frame.material].filter(Boolean).join(" · ")}
              price={Number(frame.price) || 0}
              to="/molduras"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
