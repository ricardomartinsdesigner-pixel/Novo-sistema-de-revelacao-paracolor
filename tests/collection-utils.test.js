import test from "node:test";
import assert from "node:assert/strict";
import { toArray } from "../src/lib/collection-utils.js";

test("toArray aceita listas diretas e respostas paginadas", () => {
  assert.deepEqual(toArray([1, 2]), [1, 2]);
  assert.deepEqual(toArray({ items: [3] }), [3]);
});

test("toArray devolve lista vazia para respostas ausentes ou malformadas", () => {
  assert.deepEqual(toArray(null), []);
  assert.deepEqual(toArray({ items: null }), []);
  assert.deepEqual(toArray({ items: {} }), []);
});
