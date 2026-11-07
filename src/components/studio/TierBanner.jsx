import { formatBRL } from "@/lib/areas";
import { nextTierHint, photoCategory, priceKey, resolveTier, sortTiers, tierRangeLabel } from "@/lib/quantity-pricing";

// Faixa fixa acima das fotos: mostra a faixa de desconto aplicada hoje, o preço
// por foto e quanto falta (e quanto cai) para entrar na faixa seguinte.
export default function TierBanner({ area, count, sizeIds = [], sizes = [], tiers = [], tierPrices = [] }) {
  const category = photoCategory(area);
  const list = sortTiers(tiers.filter((tier) => (tier.category || "revelacao") === category));
  if (!list.length || !count) return null;

  const current = resolveTier(count, list);
  const hint = nextTierHint(count, list);
  const nextTier = hint ? list.find((tier) => Number(tier.min_qty) === hint.min) || null : null;

  const priceMap = new Map(tierPrices.map((price) => [priceKey(price.tier_id, price.size_id), Number(price.unit_price)]));
  const sizeName = (id) =>
    sizes.find((size) => size.id === id)?.name ||
    tierPrices.find((price) => price.size_id === id)?.size_name ||
    "Formato";

  const priceList = (tierId) =>
    sizeIds
      .map((id) => ({ name: sizeName(id), unit: priceMap.get(priceKey(tierId, id)) }))
      .filter((entry) => Number.isFinite(entry.unit));

  const currentPrices = current ? priceList(current.id) : [];
  const nextPrices = nextTier ? priceList(nextTier.id) : [];

  const base = current ? Number(current.min_qty) || 0 : 0;
  const progress = nextTier
    ? Math.min(100, Math.max(4, ((count - base) / Math.max(1, hint.min - base)) * 100))
    : 100;

  return (
    <div className="mt-4 rounded-xl border border-gold/50 bg-gold-soft/50 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[13px] font-medium text-foreground">
          {current ? `Sua faixa: ${tierRangeLabel(current)} fotos` : "Nenhuma faixa aplicada ainda"}
          <span className="ml-2 text-[11px] font-normal uppercase tracking-[0.14em] text-gold-deep">
            {count} foto(s) no pedido
          </span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          {nextTier
            ? `Envie mais ${hint.missing} foto(s) e o preço cai na faixa de ${hint.min}+`
            : "Você está na maior faixa de desconto"}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
        {currentPrices.length ? (
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Agora</span>
            {currentPrices.map((entry) => (
              <span key={`now-${entry.name}`} className="font-medium text-foreground">
                {entry.name} {formatBRL(entry.unit)}
                <span className="font-normal text-muted-foreground"> cada</span>
              </span>
            ))}
          </span>
        ) : null}
        {nextPrices.length ? (
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Na próxima</span>
            {nextPrices.map((entry) => (
              <span key={`next-${entry.name}`} className="font-medium text-gold-deep">
                {entry.name} {formatBRL(entry.unit)}
                <span className="font-normal"> cada</span>
              </span>
            ))}
          </span>
        ) : null}
      </div>

      {nextTier ? (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-gold-deep transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      {nextTier ? (
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          Quanto mais fotos no mesmo pedido, mais barato fica cada foto — envie mais {hint.missing} e o valor por
          unidade cai para a faixa {tierRangeLabel(nextTier)}.
        </p>
      ) : null}
    </div>
  );
}