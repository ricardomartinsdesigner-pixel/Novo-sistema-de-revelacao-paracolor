import { nextTierHint, resolveTier, sortTiers, tierRangeLabel } from "@/lib/quantity-pricing";

export default function DiscountTrack({ category, count, tiers = [] }) {
  const list = sortTiers(tiers.filter((tier) => (tier.category || "revelacao") === category));
  if (!list.length) return null;

  const current = resolveTier(count, list);
  const next = nextTierHint(count, list);
  const base = current ? Number(current.min_qty) || 0 : 0;
  const progress = next
    ? Math.min(100, Math.max(5, ((count - base) / Math.max(1, next.min - base)) * 100))
    : 100;

  return (
    <div className="mt-2 rounded-lg bg-secondary/60 px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1 text-[11px]">
        <span className="font-medium text-foreground">
          {current ? `Faixa atual: ${tierRangeLabel(current)} fotos` : "Nenhuma faixa aplicada"}
        </span>
        <span className="text-muted-foreground">
          {next ? `Faltam ${next.missing} foto(s) para a faixa de ${next.min}+` : "Você está na maior faixa de desconto"}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}