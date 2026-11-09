import assert from "node:assert/strict";
import test from "node:test";
import { photoFolder } from "../src/lib/order-paths.js";

test("revelação agrupa tamanho e cópias na mesma pasta", () => {
  const photo = { area: "revelacao", size_name: "10 × 15 cm" };
  assert.equal(photoFolder({ ...photo, copies: 1 }), "Fotos_Impressao/10x15");
  assert.equal(photoFolder({ ...photo, copies: 2 }), "Fotos_Impressao/10x15 2 cópias");
  assert.equal(photoFolder({ ...photo, size_name: "13x18", copies: 3 }), "Fotos_Impressao/13x18 3 cópias");
  assert.equal(photoFolder({ ...photo, size_name: "Clássica", width_cm: 10, height_cm: 15 }), "Fotos_Impressao/10x15");
});

test("polaroides identificam Baby, Mini e Normal pelos tamanhos", () => {
  const photo = { area: "polaroid" };
  assert.equal(photoFolder({ ...photo, size_name: "Polaroid 5 x 7" }), "Polaroids/Polaroide Baby");
  assert.equal(photoFolder({ ...photo, size_name: "7×9 cm", copies: 4 }), "Polaroids/Polaroide Mini 4 cópias");
  assert.equal(photoFolder({ ...photo, size_name: "Branca", width_cm: 11, height_cm: 9, copies: 2 }), "Polaroids/Polaroide Normal 2 cópias");
});

test("formatos adicionais continuam identificados no ZIP", () => {
  assert.equal(photoFolder({ area: "polaroid", size_name: "Especial 10x12", copies: 2 }), "Polaroids/Especial_10x12 2 cópias");
  assert.equal(photoFolder({ area: "banner", size_name: "60x90", copies: 2 }), "Banner/60x90/2_COPIAS");
});
