import test from "node:test";
import assert from "node:assert/strict";
import { applyPhotoColorPixels, PHOTO_COLOR_EFFECTS, photoColorEffect, photoColorFilter } from "../src/lib/photo-color-effects.js";
import { pickAdjustments } from "../src/lib/studio-draft.js";

test("fotos antigas usam as cores originais e o rascunho guarda o efeito escolhido", () => {
  assert.equal(photoColorEffect(undefined), "original");
  assert.equal(photoColorEffect("toString"), "original");
  assert.equal(photoColorFilter("original"), "none");
  assert.deepEqual(pickAdjustments({ colorEffect: "sepia", preview: "blob:arquivo" }), { colorEffect: "sepia" });
});

test("filtros de impressão por pixels produzem tons coerentes e mantêm a transparência", () => {
  const original = [220, 50, 110, 240, 0, 0, 0, 0];
  const grayscale = Uint8ClampedArray.from(original);
  const sepia = Uint8ClampedArray.from(original);
  applyPhotoColorPixels(grayscale, PHOTO_COLOR_EFFECTS.grayscale.matrix);
  applyPhotoColorPixels(sepia, PHOTO_COLOR_EFFECTS.sepia.matrix);
  assert.deepEqual([...grayscale], [90, 90, 90, 240, 0, 0, 0, 0]);
  assert.deepEqual([...sepia], [146, 130, 101, 240, 0, 0, 0, 0]);
});
