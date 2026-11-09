import { formatBRL } from "@/lib/areas";
import { nextTierHint, photoCategory, priceKey, tierRangeLabel } from "@/lib/quantity-pricing";

export default function TierBanner({ area, sizeIds, sizes, tierMap, pricing }) {
  const category = photoCategory(area);
  const formats = new Map(sizes.map((size) => [size.id, size.name]));
  const groups = new Map();
  for (const id of sizeIds) {
    const info = tierMap[id];
    if (!info?.tier) continue;
    const professional = info.pricing_table === "profissional";
    const key = (professional ? "profissional:" : "normal:") + (info.group_id ?? id);
    if (!groups.has(key)) groups.set(key, { info, professional, sizes: [] });
    groups.get(key).sizes.push({ id, name: formats.get(id) || "Formato", unit: info.unit });
  }
  if (!groups.size) return null;

  return (
    <div className="mt-4 space-y-2">
      {[...groups.entries()].map(([key, group]) => {
        const { info, professional, sizes: groupSizes } = group;
        const table = professional ? pricing.professional : pricing;
        const tiers = table.tiers.filter((tier) => (tier.category || "revelacao") === category);
        const hint = nextTierHint(info.count, tiers);
        const next = hint && tiers.find((tier) => Number(tier.min_qty) === hint.min);
        const prices = new Map(table.tierPrices.map((price) => [priceKey(price.tier_id, price.size_id), Number(price.unit_price)]));
        return (
          <section key={key} className="rounded-xl border border-gold/50 bg-gold-soft/50 px-4 py-3">
            <p className="text-[13px] font-medium text-foreground">
              {professional ? "Tabela profissional" : "Faixa por quantidade"} · {tierRangeLabel(info.tier)} · {info.count} impressão(ões) na contagem
            </p>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {groupSizes.map((size) => (
                <li key={size.id}>{size.name} · <strong>{formatBRL(size.unit)}</strong> por cópia</li>
              ))}
            </ul>
            {next && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Mais {hint.missing} cópia(s) para a faixa de {tierRangeLabel(next)}.
                {groupSizes.map((size) => {
                  const unit = prices.get(priceKey(next.id, size.id));
                  return Number.isFinite(unit) ? " " + size.name + " " + formatBRL(unit) + " por cópia." : "";
                }).join("")}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
