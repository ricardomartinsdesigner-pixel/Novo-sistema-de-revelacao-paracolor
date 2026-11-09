import test from "node:test";
import assert from "node:assert/strict";
import {
  detectImageOrientation,
  orientPrintDimensions,
  printDimensionsForSize,
} from "../src/lib/print-orientation.js";

test("detecta paisagem, retrato, quadrada e dimensões ainda desconhecidas", () => {
  assert.equal(detectImageOrientation(3000, 2000), "landscape");
  assert.equal(detectImageOrientation(2000, 3000), "portrait");
  assert.equal(detectImageOrientation(1000, 1005), "square");
  assert.equal(detectImageOrientation(0, 1000), "unknown");
});

test("usa o par completo do corte real e o vira para acompanhar a foto", () => {
  const size = {
    name: "10x15",
    width_cm: 10,
    height_cm: 15,
    print_width_cm: 9.6,
    print_height_cm: 14.4,
  };

  assert.deepEqual(printDimensionsForSize(size, "portrait"), {
    widthCm: 9.6,
    heightCm: 14.4,
    orientation: "portrait",
  });
  assert.deepEqual(printDimensionsForSize(size, "landscape"), {
    widthCm: 14.4,
    heightCm: 9.6,
    orientation: "landscape",
  });
  assert.equal(14.4 / 9.6, 1.5);
});

test("se faltar uma medida do corte, volta ao par comercial sem misturar medidas", () => {
  const size = {
    name: "10x15",
    width_cm: 10,
    height_cm: 15,
    print_width_cm: 9.6,
  };

  assert.deepEqual(printDimensionsForSize(size, "landscape"), {
    widthCm: 15,
    heightCm: 10,
    orientation: "landscape",
  });
});

test("mantém a medida escolhida quando a orientação da imagem é quadrada ou desconhecida", () => {
  assert.deepEqual(orientPrintDimensions(10, 15, "square"), {
    widthCm: 10,
    heightCm: 15,
    orientation: "portrait",
  });
  assert.deepEqual(orientPrintDimensions(10, 15, "unknown"), {
    widthCm: 10,
    heightCm: 15,
    orientation: "portrait",
  });
});
