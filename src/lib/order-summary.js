import { copiesOf, sizeLabel } from "@/lib/order-paths";

const NOUNS = {
  revelacao: ["foto", "fotos"],
  polaroid: ["polaroid", "polaroids"],
  banner: ["banner", "banners"],
  personalizado: ["personalizado", "personalizados"],
  moldura: ["moldura", "molduras"],
};

/**
 * Resumo do que vai ser produzido, lido das fotos e dos itens do pedido.
 * Ex.: ["16 fotos 10x15", "2 polaroids 7x9", "1 banner 60x90"]
 */
export function productionSummary({ photos = [], items = [] }) {
  const groups = new Map();
  for (const photo of photos) {
    const area = photo.area || "revelacao";
    const size = sizeLabel(photo);
    const key = `${area}|${size}`;
    groups.set(key, (groups.get(key) || 0) + copiesOf(photo));
  }

  if (groups.size) {
    return Array.from(groups.entries()).map(([key, count]) => {
      const [area, size] = key.split("|");
      const [one, many] = NOUNS[area] || NOUNS.revelacao;
      const sizeText = size === "Sem_tamanho" ? "" : size;
      return { count, area, size: sizeText, label: `${count} ${count === 1 ? one : many} ${sizeText}`.trim() };
    });
  }

  return items.map((item, index) => ({
    count: item.qty || 1,
    area: item.area || "outro",
    size: "",
    label: `${item.qty || 1}x ${item.product_name}`,
    key: `item-${index}`,
  }));
}