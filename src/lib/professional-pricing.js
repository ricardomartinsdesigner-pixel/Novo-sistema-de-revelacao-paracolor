import { priceKey } from "./quantity-pricing.js";

export const PROFESSIONAL_TABLE_ID = "revelacao";
export const EMPTY_PROFESSIONAL_TABLE = { tiers: [], prices: [], shared_size_ids: [] };

export function professionalPricingData(table) {
  if (!table) return null;
  return {
    tiers: table.tiers.map((tier) => ({ ...tier, category: "revelacao", active: true })),
    tierPrices: table.prices,
    groups: table.shared_size_ids.length > 0
      ? [{ id: "profissional", name: "Contagem compartilhada", category: "revelacao", size_ids: table.shared_size_ids }]
      : [],
  };
}

export function checkProfessionalTable(table, sizes) {
  const activeSizes = sizes.filter((size) => size.active !== false);
  const tiers = [...table.tiers].sort((a, b) => a.min_qty - b.min_qty);
  const prices = new Map(table.prices.map((price) => [priceKey(price.tier_id, price.size_id), price.unit_price]));
  const missing = activeSizes.flatMap((size) => tiers.filter((tier) => {
    const unit = prices.get(priceKey(tier.id, size.id));
    return !Number.isFinite(unit) || unit <= 0;
  }).map((tier) => ({ size, tier })));

  let issue = "";
  if (!activeSizes.length) issue = "Cadastre ao menos um tamanho ativo de revelação.";
  else if (!tiers.length) issue = "Cadastre ao menos uma faixa.";
  else if (new Set(tiers.map((tier) => tier.id)).size !== tiers.length || prices.size !== table.prices.length) {
    issue = "Há faixas ou preços duplicados na tabela.";
  }
  else if (tiers.some((tier) => !tier.label.trim())) issue = "Informe o nome de cada faixa.";
  else if (tiers[0].min_qty !== 1) issue = "A primeira faixa precisa começar em 1.";
  else if (tiers.some((tier, index) => {
    if (!Number.isInteger(tier.min_qty) || tier.min_qty < 1) return true;
    if (index === tiers.length - 1) return tier.max_qty !== 0;
    return !Number.isInteger(tier.max_qty) || tier.max_qty < tier.min_qty || tiers[index + 1].min_qty !== tier.max_qty + 1;
  })) issue = "Preencha faixas consecutivas, sem intervalos ou sobreposição. Use 0 como máximo da última faixa.";

  return { issue, missing, complete: !issue && !missing.length };
}
