import { copiesOf, sizeLabel } from "./order-paths.js";

const PRINT_AREAS = new Set(["revelacao", "polaroid", "magnet"]);
const POLAROID_SIZES = { baby: "5×7", mini: "7×9", normal: "9×11" };
const NOUNS = {
  revelacao: ["foto", "fotos"],
  polaroid: ["polaroide", "polaroides"],
  magnet: ["ímã", "ímãs"],
};

function dimensions(value) {
  const parts = String(value || "").match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  return parts?.slice(1)
    .map((part) => Number(part.replace(",", ".")))
    .sort((a, b) => a - b)
    .map((part) => String(part).replace(".", ",")).join("×");
}

function printSize(value, area, photo, fallback) {
  const label = String(value || "").trim().replace(/^(revelação|polaroide?)\s*(?:[-–]\s*)?/i, "");
  const measured = photo?.width_cm > 0 && photo?.height_cm > 0
    ? dimensions(`${photo.width_cm}×${photo.height_cm}`) : "";
  return dimensions(label) || measured || (area === "polaroid" && POLAROID_SIZES[label.toLowerCase()])
    || fallback || (label === "Sem_tamanho" ? "" : label);
}

export function productionSummary({ photos = [], items = [] }) {
  const prints = new Map();
  const itemsById = new Map(items.filter((item) => item.id).map((item) => [item.id, item]));
  const sizesByItem = new Map();
  const products = new Map();

  function group(area, size) {
    const key = `${area}:${size.toLowerCase()}`;
    if (!prints.has(key)) prints.set(key, { key, area, size, copies: 0, itemCopies: 0 });
    return prints.get(key);
  }

  for (const photo of photos) {
    const linked = itemsById.get(photo.item_id);
    const area = photo.area || linked?.area || "revelacao";
    if (area === "magnet" && linked?.options?.magnet_kind === "strip_kit") continue;
    if (!PRINT_AREAS.has(area)) continue;
    const size = printSize(sizeLabel(photo), area, photo, printSize(linked?.variant, area));
    if (linked && size) {
      if (!sizesByItem.has(linked.id)) sizesByItem.set(linked.id, new Set());
      sizesByItem.get(linked.id).add(size);
    }
    group(area, size).copies += copiesOf(photo);
  }

  for (const item of items) {
    const count = Math.max(1, Math.round(Number(item.qty) || 1));
    if (PRINT_AREAS.has(item.area) && !(item.area === "magnet" && item.options?.magnet_kind === "strip_kit")) {
      const linkedSizes = sizesByItem.get(item.id);
      if (linkedSizes?.size > 1) continue;
      const size = linkedSizes?.values().next().value || printSize(item.variant || item.product_name, item.area);
      if (!size && [...prints.values()].some((print) => print.area === item.area && print.copies > 0)) continue;
      group(item.area, size).itemCopies += count;
    } else {
      const title = String(item.product_name || "Produto").trim() || "Produto";
      const key = `product:${item.area}:${title.toLowerCase()}`;
      if (!products.has(key)) products.set(key, { key, title, count: 0 });
      products.get(key).count += count;
    }
  }

  const photoGroups = [...prints.values()].map(({ key, area, size, copies, itemCopies }) => {
    const count = Math.max(copies, itemCopies);
    const title = `${NOUNS[area][count === 1 ? 0 : 1]} ${size}`.trim();
    return { key, count, title };
  });
  return [...photoGroups, ...products.values()].map((item) => ({ ...item, label: `${item.count} ${item.title}` }));
}
