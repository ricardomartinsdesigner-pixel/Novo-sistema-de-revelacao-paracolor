export const MAX_ORDER_PHOTOS = 1000;

export function movePhoto(photos, id, position) {
  const from = photos.findIndex((photo) => photo.id === id);
  if (from < 0 || !Number.isInteger(position) || position < 0 || position >= photos.length || position === from) return photos;
  const next = [...photos];
  const [photo] = next.splice(from, 1);
  next.splice(position, 0, photo);
  return next;
}

// Cada entrada do editor pode gerar vários itens por tamanho. Reúna o lote
// para recuperar a sequência escolhida antes de atribuir posições no pedido.
export function numberCartPhotos(items, batchKeys) {
  const batches = new Map();
  items.forEach((item, index) => {
    const key = batchKeys[index] || index;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(...item.photos);
  });
  let position = 0;
  for (const batch of batches.values()) {
    batch.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
    for (const photo of batch) photo.position = position++;
  }
  return items;
}

export function orderPhotosForItems(items) {
  const photos = items.flatMap((item, itemIndex) =>
    (item.photos ?? []).map((photo) => ({ photo, itemIndex }))
  );
  // Posições ausentes em carrinhos antigos conservam a sequência dos itens.
  if (photos.every(({ photo }) => Number.isInteger(photo.position))) {
    photos.sort((a, b) => a.photo.position - b.photo.position);
  }
  return photos;
}

export async function listOrderPhotos(entities, orderId) {
  const photos = (await entities.OrderPhoto.filter({ order_id: orderId }, { limit: MAX_ORDER_PHOTOS, sort: "sort" })).items ?? [];
  const positions = new Set(photos.map((photo) => photo.sort));
  if (positions.size === photos.length && photos.every((photo) => Number.isInteger(photo.sort))) return photos;
  return [...photos].sort((a, b) =>
    String(a.created_date ?? "").localeCompare(String(b.created_date ?? "")) || String(a.id).localeCompare(String(b.id))
  );
}
