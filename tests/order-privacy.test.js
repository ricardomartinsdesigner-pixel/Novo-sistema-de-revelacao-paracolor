import test from "node:test";
import assert from "node:assert/strict";
import { canAccessOrder, createOrderDownload, verifyOrderDownload } from "../src/lib/order-download.server.js";
import { publicOrderHistory } from "../src/lib/customer-order.js";

test("ZIP exige a conta que gerou o link e vincula pedido, filtro e prazo", () => {
  process.env.SESSION_SECRET = "fixture-private-order-link-secret-long";
  const owner = { id: "owner" };
  const other = { id: "other" };
  const admin = { id: "admin", role: "admin" };
  const order = { id: "order", created_by_id: owner.id };
  assert.equal(canAccessOrder(owner, order), true);
  assert.equal(canAccessOrder(other, order), false);
  assert.equal(canAccessOrder(admin, order), true);
  const { url } = createOrderDownload(owner, order, "impressao", "10x15");
  const query = new URL(url, "https://test.invalid").searchParams;
  const expires = query.get("expires");
  const token = query.get("token");
  assert.equal(verifyOrderDownload(owner, order.id, "impressao", "10x15", expires, token), true);
  assert.equal(verifyOrderDownload(admin, order.id, "impressao", "10x15", expires, token), false);
  assert.equal(verifyOrderDownload(null, order.id, "impressao", "10x15", expires, token), false);
  assert.equal(verifyOrderDownload(other, order.id, "impressao", "10x15", expires, token), false);
  assert.equal(verifyOrderDownload(owner, "other-order", "impressao", "10x15", expires, token), false);
  assert.equal(verifyOrderDownload(owner, order.id, "originais", "10x15", expires, token), false);
  assert.equal(verifyOrderDownload(owner, order.id, "impressao", "", expires, token), false);
  assert.equal(verifyOrderDownload(owner, order.id, "impressao", "10x15", expires, token, Number(expires)), false);
});

test("a consulta pública projeta somente datas e estados públicos", () => {
  const date = "2026-11-08T12:00:00.000Z";
  assert.deepEqual(publicOrderHistory([
    null,
    { status: "aguardando_conferencia", date, note: "interno" },
    { status: "em_producao", date, note: "não publicar", by: "operador", email: "privado@example.test" },
    { status: "pronto", date: "inválida" },
  ]), [{ status: "em_producao", date }]);
});
