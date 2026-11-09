import test from "node:test";
import assert from "node:assert/strict";
import { maxPrintSize, printFillPpi, resolutionLevel } from "../src/lib/print-resolution.js";

test("a dimensão máxima preserva a proporção e não arredonda o limite para cima", () => {
  assert.deepEqual(maxPrintSize(1800, 1200, 200), [22.8, 15.2]);
  assert.deepEqual(maxPrintSize(1800, 1200, 300), [15.2, 10.1]);
  assert.deepEqual(maxPrintSize(1200, 1800, 300), [10.1, 15.2]);
});

test("a nitidez ao preencher o papel considera o lado limitante e a orientação", () => {
  assert.equal(printFillPpi(1800, 1200, 10, 15), 304);
  assert.equal(printFillPpi(1200, 1800, 10, 15), 304);
  assert.equal(printFillPpi(1800, 1200, 13, 18), 234);
  assert.equal(printFillPpi(1000, 1000, 10, 15), 169);
  assert.equal(printFillPpi(1000, 1500, 12.7, 19.05), 200);
  assert.equal(resolutionLevel(300).level, "excelente");
  assert.equal(resolutionLevel(200).level, "adequada");
  assert.equal(resolutionLevel(199).level, "baixa");
  assert.equal(resolutionLevel(149).level, "insuficiente");
});
