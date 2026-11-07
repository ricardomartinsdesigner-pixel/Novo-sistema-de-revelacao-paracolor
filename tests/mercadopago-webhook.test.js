import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyMercadoPagoSignature } from "../src/lib/mercadopago-webhook.server.js";

function makeSignature(secret, requestId, dataId, timestamp) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  return `ts=${timestamp},v1=${createHmac("sha256", secret).update(manifest).digest("hex")}`;
}

test("valida assinatura Mercado Pago em segundos e milissegundos", () => {
  const now = 1_800_000_000_000;
  for (const timestamp of [String(Math.floor(now / 1000)), String(now)]) {
    assert.equal(verifyMercadoPagoSignature({
      secret: "webhook-test-secret", signature: makeSignature("webhook-test-secret", "req-1", "pay-1", timestamp),
      requestId: "req-1", dataId: "pay-1", now,
    }), true);
  }
});

test("recusa assinatura alterada, incompleta e expirada", () => {
  const now = 1_800_000_000_000;
  const valid = makeSignature("webhook-test-secret", "req-1", "pay-1", String(Math.floor(now / 1000)));
  assert.equal(verifyMercadoPagoSignature({ secret: "wrong", signature: valid, requestId: "req-1", dataId: "pay-1", now }), false);
  assert.equal(verifyMercadoPagoSignature({ secret: "webhook-test-secret", signature: valid, requestId: "req-1", dataId: "pay-2", now }), false);
  assert.equal(verifyMercadoPagoSignature({ secret: "webhook-test-secret", signature: valid, requestId: "req-1", dataId: "pay-1", now: now + 600_000 }), false);
  assert.equal(verifyMercadoPagoSignature({ secret: "webhook-test-secret", signature: "ts=1,v1=xyz", requestId: "req-1", dataId: "pay-1", now }), false);
});
