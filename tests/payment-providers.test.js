import assert from "node:assert/strict";
import test from "node:test";
import { openSecret, sealSecret } from "../src/lib/security-secrets.server.js";
import { checkoutPaymentMethods } from "../src/lib/order-payment.js";
import { stonePaymentMatches } from "../src/lib/payment-adapters.server.js";
import { totpCode } from "../src/lib/vps/admin-mfa.server.js";

test("credenciais criptografadas ficam vinculadas ao provedor", () => {
  const saved = process.env.SECURITY_SECRETS_KEY;
  process.env.SECURITY_SECRETS_KEY = "ab".repeat(32);
  try {
    const encrypted = sealSecret({ apiKey: "credencial-sensivel" }, "payment-provider:pagarme");
    assert.ok(!encrypted.includes("credencial-sensivel"));
    assert.deepEqual(openSecret(encrypted, "payment-provider:pagarme"), { apiKey: "credencial-sensivel" });
    assert.throws(() => openSecret(encrypted, "payment-provider:infinitepay"));
    assert.throws(() => openSecret(encrypted.replace(/^./, encrypted[0] === "A" ? "B" : "A"), "payment-provider:pagarme"));
  } finally {
    if (saved === undefined) delete process.env.SECURITY_SECRETS_KEY;
    else process.env.SECURITY_SECRETS_KEY = saved;
  }
});

test("prioridade dos provedores preserva o fluxo dos profissionais", () => {
  const providers = ["sicoob_pix", "pagarme"];
  assert.deepEqual(checkoutPaymentMethods({ providers, onlineEnabled: true, fulfillment: "retirada",
    user: { professional_pricing: true, allow_pickup_payment: true } }), ["sicoob_pix", "pagarme", "mercadopago", "pagar_na_retirada"]);
  assert.deepEqual(checkoutPaymentMethods({ providers, settings: { allow_store_payment: false } }), providers);
});

test("Stone exige correspondência de moeda, valor e origem da cobrança", () => {
  const attempt = { remoteId: "pl_original", ref: "a".repeat(32), amount: 1300 };
  const order = { currency: "BRL", amount: 1300, payment_link_id: "pl_original" };
  assert.equal(stonePaymentMatches(order, attempt), true);
  assert.equal(stonePaymentMatches({ ...order, amount: 1299 }, attempt), false);
  assert.equal(stonePaymentMatches({ ...order, currency: "USD" }, attempt), false);
  assert.equal(stonePaymentMatches({ ...order, payment_link_id: "pl_outra" }, attempt), false);
  assert.equal(stonePaymentMatches({ currency: "BRL", amount: 1300,
    items: [{ description: "Pedido [" + attempt.ref + "]", amount: 1300, quantity: 1 }] }, attempt), true);
});

test("TOTP usa a janela de 30 segundos do vetor de referência", () => {
  assert.equal(totpCode(Buffer.from("12345678901234567890"), 1), "287082");
});
