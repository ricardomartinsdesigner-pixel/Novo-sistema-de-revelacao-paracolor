import DiscountTrack from "@/components/cart/DiscountTrack";
import { photoCategory } from "@/lib/quantity-pricing";

// Mostra no próprio envio quanto falta para a próxima faixa de desconto — o
// cálculo já existe no carrinho, mas o cliente precisa ver isso antes de fechar.
export default function TierProgress({ area, lines = [], groups = [], tiers = [] }) {
  const category = photoCategory(area);
  const categoryTiers = tiers.filter((tier) => (tier.category || "revelacao") === category);
  if (!categoryTiers.length) return null;

  const counts = {};
  for (const line of lines) {
    if (!line?.sizeId) continue;
    counts[line.sizeId] = (counts[line.sizeId] || 0) + Math.max(1, Number(line.copies) || 1);
  }

  let count = 0;
  let label = "";
  const categoryGroups = groups.filter((group) => group.active !== false && (group.category || "revelacao") === category);
  for (const group of categoryGroups) {
    const total = (group.size_ids || []).reduce((sum, id) => sum + (counts[id] || 0), 0);
    if (total > count) {
      count = total;
      label = group.name || "";
    }
  }
  if (!count) {
    const top = Object.values(counts).sort((a, b) => b - a)[0] || 0;
    count = top;
  }
  if (!count) return null;

  return (
    <div className="mt-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Desconto por quantidade{label ? ` · ${label}` : ""}
      </p>
      <DiscountTrack category={category} count={count} tiers={tiers} />
    </div>
  );
}