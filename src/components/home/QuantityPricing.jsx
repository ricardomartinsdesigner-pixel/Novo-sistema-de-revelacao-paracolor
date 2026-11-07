import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEntityList } from "@/lib/store";
import { formatBRL } from "@/lib/areas";
import { sortTiers, tierRangeLabel } from "@/lib/quantity-pricing";
import { useSiteContent } from "@/hooks/use-site-content";
import { fillVars } from "@/lib/site-content";

export default function QuantityPricing() {
  const { content } = useSiteContent();
  const { data: sizes = [] } = useEntityList("PhotoSize", { active: true }, { sort: "sort", limit: 50 });
  const { data: tiers = [] } = useEntityList("QuantityTier", { category: "revelacao", active: true }, { sort: "sort", limit: 20 });
  const { data: tierPrices = [] } = useEntityList("TierPrice", { category: "revelacao" }, { limit: 500 });

  const reference = sizes.find((size) => size.name === "10x15") || sizes[0];
  if (!reference) return null;

  const base = Number(reference.price) || 0;
  const rows = sortTiers(tiers)
    .map((tier) => {
      const match = tierPrices.find((price) => price.tier_id === tier.id && price.size_id === reference.id);
      return match ? { tier, unit: Number(match.unit_price) || 0 } : null;
    })
    .filter(Boolean);

  if (!rows.length) return null;

  const titleLines = (content["home.quantity.title"] || "").split("\n");

  return (
    <section className="border-t border-border/70 py-20">
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="eyebrow">{content["home.quantity.eyebrow"]}</p>
          <h2 className="mt-3 text-4xl leading-tight">
            {titleLines.map((line, index) => (
              <span key={index} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            {fillVars(content["home.quantity.text"], { tamanho: reference.name })}
          </p>
          <Link to="/revelar" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary">
            Revelar minhas fotos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="elev-2 overflow-hidden rounded-[1.25rem] border border-border/80 bg-card">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border/70 bg-secondary/40 px-6 py-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>Quantidade</span>
            <span className="text-right">Por foto</span>
            <span className="w-16 text-right">Economia</span>
          </div>
          {rows.map(({ tier, unit }) => {
            const off = base > 0 && unit < base ? Math.round((1 - unit / base) * 100) : 0;
            return (
              <div
                key={tier.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border/40 px-6 py-3.5 text-sm last:border-0"
              >
                <span className="font-medium">{tierRangeLabel(tier)} fotos</span>
                <span className="text-right font-display text-lg">{formatBRL(unit)}</span>
                <span className="w-16 text-right">
                  {off > 0 ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      -{off}%
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}