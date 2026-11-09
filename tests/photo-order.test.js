import test from "node:test";
import assert from "node:assert/strict";
import { checkoutItems } from "../src/lib/cart-items.js";
import { listOrderPhotos, MAX_ORDER_PHOTOS, movePhoto, orderPhotosForItems } from "../src/lib/photo-order.js";

for (const area of ["revelacao", "polaroid"]) {
  test("1.000 fotos com formatos mistos preservam a ordem em " + area, () => {
    const original = Array.from({ length: MAX_ORDER_PHOTOS }, (_, i) => ({ id: String(i), size: i % 2 }));
    const ordered = movePhoto(original, "0", 999);
    const photos = ordered.map((photo, position) => ({ ...photo, position }));
    const items = [0, 1].map((size) => ({
      area, ref_id: String(size), photoBatch: "lote", photos: photos.filter((photo) => photo.size === size),
    }));
    const saved = orderPhotosForItems(checkoutItems(items));
    assert.deepEqual(saved.map(({ photo }) => photo.id), ordered.map((photo) => photo.id));
    assert.equal(new Set(saved.map(({ photo }) => photo.position)).size, 1000);
  });
}

test("a sequência do pedido respeita lotes separados e carrinhos anteriores", () => {
  const items = [
    { area: "revelacao", photos: [{ id: "antiga" }] },
    { area: "polaroid", photoBatch: "b", photos: [{ id: "b1", position: 0 }, { id: "b3", position: 2 }] },
    { area: "polaroid", photoBatch: "b", photos: [{ id: "b2", position: 1 }] },
    { area: "revelacao", photoBatch: "c", photos: [{ id: "c1", position: 0 }] },
  ];
  const saved = orderPhotosForItems(checkoutItems(items));
  assert.deepEqual(saved.map(({ photo }) => photo.id), ["antiga", "b1", "b2", "b3", "c1"]);
});

test("consulta até 1.000 fotos e mantém sequência estável em pedidos antigos", async () => {
  const entities = { OrderPhoto: { async filter(query, options) {
    assert.deepEqual(query, { order_id: "pedido" });
    assert.deepEqual(options, { limit: 1000, sort: "sort" });
    return { items: [
      { id: "b", sort: 0, created_date: "2026-01-02" },
      { id: "a", sort: 0, created_date: "2026-01-01" },
    ] };
  } } };
  assert.deepEqual((await listOrderPhotos(entities, "pedido")).map((photo) => photo.id), ["a", "b"]);
});
