export const isPhotoItem = (item) => ["revelacao", "polaroid"].includes(item.area);
export const cartLineTotal = (item) => Math.round(Number(item.unitPrice || 0) * (isPhotoItem(item) ? 1 : Number(item.qty || 1)) * 100) / 100;
export const cartPhotoCount = (item) => (item.photos || []).reduce((sum, photo) => sum + Number(photo.copies || 1), 0);
const durable = (value) => typeof value === "string" && !/^(blob:|data:)/.test(value) ? value : "";

export function normalizeCartItem(item) {
  const photos = (item.photos || []).map(({ preview, ...photo }) => photo);
  return { ...item, qty: isPhotoItem(item) ? 1 : Math.min(99, Math.max(1, Math.trunc(Number(item.qty) || 1))), photos,
    image: durable(item.image), options: { ...item.options, preview_uri: durable(item.options?.preview_uri) } };
}

export function checkoutItems(items, approval) {
  return items.map((item) => ({
    area: item.area, ref_id: item.ref_id, product_name: item.title, variant: item.subtitle || "",
    qty: isPhotoItem(item) ? 1 : Number(item.qty || 1),
    options: { ...item.options, ...(approval === undefined ? {} : { art_approval_requested: approval }) },
    photos: (item.photos || []).map(({ preview, ...photo }) => photo),
    preview_uri: durable(item.options?.preview_uri),
  }));
}