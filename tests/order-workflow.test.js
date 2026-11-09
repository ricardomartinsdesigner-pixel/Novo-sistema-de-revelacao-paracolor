import test from "node:test";
import assert from "node:assert/strict";
import { orderStatusAfterArtApproval } from "../src/lib/order-art-status.js";
import { productionSummary } from "../src/lib/order-summary.js";

test("a aprovação da arte preserva o status da produção e da entrega", () => {
  for (const status of ["em_producao", "aguardando_conferencia", "pronto", "enviado", "concluido", "cancelado"]) {
    assert.equal(orderStatusAfterArtApproval({ status, payment_status: "aprovado" }), status);
    assert.equal(orderStatusAfterArtApproval({
      status: "aguardando_aprovacao", payment_status: "aprovado",
      status_history: [{ status }, { status: "aguardando_aprovacao" }],
    }), status);
  }
});

test("a aprovação libera a fila para pedido pago ou profissional autorizado", () => {
  const order = { status: "aguardando_arte" };
  assert.equal(orderStatusAfterArtApproval({ ...order, payment_status: "aprovado" }), "aguardando_producao");
  assert.equal(orderStatusAfterArtApproval({ ...order, payment_status: "pendente" }), "aguardando_pagamento");
  assert.equal(orderStatusAfterArtApproval({
    ...order, payment_status: "pendente", payment_method: "pagar_na_retirada",
    customer_professional: true, fulfillment: "retirada",
  }), "aguardando_producao");
});

test("o resumo usa cópias por tamanho e agrupa os produtos iguais por quantidade", () => {
  const items = [
    { id: "a", area: "revelacao", variant: "10 x 15", qty: 12 },
    { id: "b", area: "revelacao", variant: "13×18", qty: 3 },
    { id: "c", area: "polaroid", variant: "Baby", qty: 2 },
    { id: "d", area: "personalizado", product_name: "Caneca de porcelana", qty: 1 },
    { id: "e", area: "personalizado", product_name: "Caneca de porcelana", qty: 1 },
  ];
  const photos = [
    { item_id: "a", area: "revelacao", width_cm: 15, height_cm: 10, copies: 12 },
    { item_id: "b", area: "revelacao", size_name: "13 x 18 cm", copies: 3 },
    { item_id: "c", area: "polaroid", size_name: "Polaroide Baby", copies: 2 },
    { item_id: "d", area: "personalizado", copies: 1 },
  ];
  const expected = ["12 fotos 10×15", "3 fotos 13×18", "2 polaroides 5×7", "2 Caneca de porcelana"];
  assert.deepEqual(productionSummary({ items, photos }).map((row) => row.label), expected);
  assert.deepEqual(productionSummary({ items }).map((row) => row.label), expected);
});
