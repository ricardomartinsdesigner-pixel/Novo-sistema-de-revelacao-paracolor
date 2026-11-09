export const PHOTO_AREAS = ["revelacao", "polaroid"];
export const PHOTO_CATEGORIES = [...PHOTO_AREAS, "magnet"];
export const isPhotoArea = (area) => PHOTO_CATEGORIES.includes(area);

export const photoCategory = (area) => area === "magnet" ? "magnet" : area === "polaroid" ? "polaroid" : "revelacao";
export const categoryLabel = (category) => ({ polaroid: "Polaroides", magnet: "Ímãs de foto" }[category] || "Revelação");

export function sortTiers(tiers = []) {
  return [...tiers]
    .filter((tier) => tier.active !== false)
    .sort((a, b) => (Number(a.min_qty) || 0) - (Number(b.min_qty) || 0));
}

export function tierRangeLabel(tier) {
  if (!tier) return "";
  const min = Number(tier.min_qty) || 0;
  const max = Number(tier.max_qty) || 0;
  if (!max) return `${min} ou mais`;
  if (min === max) return `${min}`;
  return `${min} a ${max}`;
}

export function resolveTier(count, tiers = []) {
  let found = null;
  for (const tier of sortTiers(tiers)) {
    const min = Number(tier.min_qty) || 0;
    const max = Number(tier.max_qty) || 0;
    if (count >= min && (max === 0 || count <= max)) found = tier;
  }
  return found;
}

export function priceKey(tierId, sizeId) {
  return `${tierId}:${sizeId}`;
}

export function photoCounts(lines = []) {
  const counts = { revelacao: {}, polaroid: {}, magnet: {} };
  for (const line of lines) {
    if (!line?.sizeId) continue;
    const category = photoCategory(line.area);
    if (category === "magnet" && line.kind === "strip_kit") continue;
    const copies = Math.max(1, Number(line.copies) || 1);
    counts[category][line.sizeId] = (counts[category][line.sizeId] || 0) + copies;
  }
  return counts;
}

export function linesFromItems(items = []) {
  const lines = [];
  for (const item of items) {
    if (!isPhotoArea(item.area)) continue;
    if (item.options?.photo_3x4) continue;
    for (const photo of item.photos || []) {
      lines.push({ area: item.area, sizeId: item.ref_id, copies: photo.copies || 1, kind: item.options?.magnet_kind || "" });
    }
  }
  return lines;
}

/**
 * Resolves the unit price per size for a set of photo counts.
 * Sizes in the same group share the count, so 10x15 + 13x18 + 15x21 reach the tier together.
 */
export function pricingContext({ tiers = [], tierPrices = [], groups = [], counts = {}, professional = null }) {
  const prices = new Map(tierPrices.map((price) => [priceKey(price.tier_id, price.size_id), Number(price.unit_price)]));
  const result = { revelacao: {}, polaroid: {}, magnet: {} };
  const totals = PHOTO_AREAS.map((category) => Object.values(counts[category] || {}).reduce((sum, copies) => sum + copies, 0));
  const mixedTotal = totals.every((total) => total > 0) ? totals[0] + totals[1] : 0;

  for (const category of PHOTO_CATEGORIES) {
    const categoryTiers = tiers.filter((tier) => (tier.category || "revelacao") === category);
    const categoryGroups = groups.filter(
      (group) => group.active !== false && (group.category || "revelacao") === category
    );
    const categoryCounts = counts[category] || {};
    if (category !== "magnet" && mixedTotal) {
      const tier = resolveTier(mixedTotal, categoryTiers);
      if (tier) for (const id of Object.keys(categoryCounts)) {
        const unit = prices.get(priceKey(tier.id, id));
        if (unit !== undefined) result[category][id] = { unit, count: mixedTotal, tier };
      }
      continue;
    }
    const handled = new Set();

    for (const group of categoryGroups) {
      const ids = group.size_ids || [];
      const total = ids.reduce((sum, id) => sum + (categoryCounts[id] || 0), 0);
      if (!total) continue;
      const tier = resolveTier(total, categoryTiers);
      if (!tier) continue;
      for (const id of ids) {
        handled.add(id);
        const unit = prices.get(priceKey(tier.id, id));
        if (unit === undefined) continue;
        result[category][id] = { unit, count: total, tier, group_id: group.id, group_name: group.name };
      }
    }

    for (const [id, total] of Object.entries(categoryCounts)) {
      if (handled.has(id)) continue;
      const tier = resolveTier(total, categoryTiers);
      if (!tier) continue;
      const unit = prices.get(priceKey(tier.id, id));
      if (unit === undefined) continue;
      result[category][id] = { unit, count: total, tier };
    }
  }

  if (professional) {
    const { revelacao } = pricingContext({ ...professional, counts: { revelacao: counts.revelacao } });
    for (const [sizeId, info] of Object.entries(revelacao)) {
      result.revelacao[sizeId] = { ...info, pricing_table: "profissional" };
    }
  }
  return result;
}

/** Recalculates cart lines with the tier prices the checkout will charge. */
export function repriceItems(items = [], context = {}, revealSizes = []) {
  const sizes = new Map(revealSizes.map((size) => [size.id, size]));
  return items.map((item) => {
    if (!isPhotoArea(item.area)) return item;
    if (item.options?.photo_3x4) return item;
    if (item.area === "magnet" && item.options?.magnet_kind === "strip_kit") return item;
    const info = context[photoCategory(item.area)]?.[item.ref_id];
    const size = item.area === "revelacao" ? sizes.get(item.ref_id) : null;
    if (!info && !size) return item;
    const unit = Number(info?.unit ?? size?.price) || 0;
    const border = Number(size?.border_price ?? item.borderPrice) || 0;
    const total = (item.photos || []).reduce(
      (sum, photo) => sum + (unit + (photo.border ? border : 0)) * Math.max(1, Number(photo.copies) || 1),
      0
    );
    return {
      ...item,
      unitPrice: Math.round(total * 100) / 100,
      tierLabel: info?.tier?.label || "",
      tierCount: info?.count,
      tierUnitPrice: info?.unit,
      pricingTable: info?.pricing_table ?? "normal",
    };
  });
}

export function nextTierHint(count, tiers = []) {
  const upcoming = sortTiers(tiers)
    .filter((tier) => Number(tier.min_qty) > count)
    .sort((a, b) => Number(a.min_qty) - Number(b.min_qty))[0];
  return upcoming ? { missing: Number(upcoming.min_qty) - count, min: Number(upcoming.min_qty) } : null;
}
