import test from "node:test";
import assert from "node:assert/strict";
import {
  awaitsPickupPayment, canProduceOrder, checkoutPaymentMethods, ONLINE_PAYMENT, PICKUP_PAYMENT, STORE_PAYMENT,
} from "../src/lib/order-payment.js";
import { checkProfessionalTable, professionalPricingData } from "../src/lib/professional-pricing.js";
import { linesFromItems, photoCounts, pricingContext, repriceItems } from "../src/lib/quantity-pricing.js";

const professional = { professional_pricing: true, allow_pickup_payment: true };
const storefront = { allow_store_payment: false };

test("the pickup exception requires a professional, individual permission and store pickup", () => {
  const input = { fulfillment: "retirada", settings: storefront, onlineEnabled: true };
  assert.deepEqual(checkoutPaymentMethods({ ...input, user: professional }), [ONLINE_PAYMENT, PICKUP_PAYMENT]);
  assert.deepEqual(checkoutPaymentMethods({ ...input, user: { allow_pickup_payment: true } }), [ONLINE_PAYMENT]);
  assert.deepEqual(checkoutPaymentMethods({ ...input, user: professional, fulfillment: "entrega" }), [ONLINE_PAYMENT]);
  assert.deepEqual(checkoutPaymentMethods({
    ...input, settings: { allow_store_payment: true }, user: { professional_pricing: true },
  }), [ONLINE_PAYMENT]);
  assert.deepEqual(checkoutPaymentMethods({
    ...input, settings: { allow_store_payment: true }, user: {},
  }), [ONLINE_PAYMENT, STORE_PAYMENT]);
  assert.deepEqual(checkoutPaymentMethods({ ...input, user: professional, onlineEnabled: false }), [PICKUP_PAYMENT]);
});

test("only an order recorded as pay on pickup can be produced with a pending payment", () => {
  const order = {
    customer_professional: true, fulfillment: "retirada", payment_method: PICKUP_PAYMENT,
    payment_status: "pendente", status: "pronto",
  };
  assert.equal(awaitsPickupPayment(order), true);
  assert.equal(canProduceOrder(order), true);
  assert.equal(canProduceOrder({ ...order, customer_professional: false }), false);
  assert.equal(canProduceOrder({ ...order, fulfillment: "entrega" }), false);
  assert.equal(canProduceOrder({ ...order, payment_method: ONLINE_PAYMENT }), false);
  assert.equal(canProduceOrder({ ...order, status: "cancelado" }), false);
  assert.equal(canProduceOrder({ ...order, payment_status: "reembolsado" }), false);
  assert.equal(awaitsPickupPayment({ ...order, payment_status: "aprovado" }), false);
  assert.equal(canProduceOrder({ payment_status: "aprovado" }), true);
});

const table = {
  tiers: [
    { id: "pro-1", label: "1 a 15", min_qty: 1, max_qty: 15 },
    { id: "pro-16", label: "16 ou mais", min_qty: 16, max_qty: 0 },
  ],
  prices: [
    { tier_id: "pro-1", size_id: "10x15", unit_price: 0.9 },
    { tier_id: "pro-1", size_id: "13x18", unit_price: 1.3 },
    { tier_id: "pro-16", size_id: "10x15", unit_price: 0.7 },
    { tier_id: "pro-16", size_id: "13x18", unit_price: 1.1 },
  ],
  shared_size_ids: ["10x15", "13x18"],
};
const sizes = [{ id: "10x15" }, { id: "13x18" }];

test("publishing requires consecutive tiers and a price for each active size", () => {
  assert.equal(checkProfessionalTable(table, [...sizes, { id: "inativo", active: false }]).complete, true);
  assert.equal(checkProfessionalTable({ ...table, prices: table.prices.slice(1) }, sizes).missing.length, 1);
  const gap = { ...table, tiers: [table.tiers[0], { ...table.tiers[1], min_qty: 17 }] };
  assert.equal(checkProfessionalTable(gap, sizes).complete, false);
  assert.equal(checkProfessionalTable({ ...table, prices: [...table.prices, table.prices[0]] }, sizes).complete, false);
});

test("professional prints share quantity across formats and preserve their own per-size prices", () => {
  const items = [
    { area: "revelacao", ref_id: "10x15", borderPrice: 0.2, photos: [{ copies: 10, border: true }] },
    { area: "revelacao", ref_id: "13x18", photos: [{ copies: 6 }] },
    { area: "revelacao", ref_id: "20x30", photos: [{ copies: 1 }] },
    { area: "polaroid", ref_id: "mini", photos: [{ copies: 3 }] },
  ];
  const counts = photoCounts(linesFromItems(items));
  const normal = {
    tiers: [
      { id: "normal", category: "revelacao", min_qty: 1, max_qty: 0 },
      { id: "polaroid", category: "polaroid", min_qty: 1, max_qty: 0 },
    ],
    tierPrices: [
      { tier_id: "normal", size_id: "10x15", unit_price: 1.5 },
      { tier_id: "normal", size_id: "20x30", unit_price: 3.8 },
      { tier_id: "polaroid", size_id: "mini", unit_price: 2.1 },
    ],
  };
  const context = pricingContext({ ...normal, counts, professional: professionalPricingData(table) });
  assert.equal(context.revelacao["10x15"].count, 16);
  assert.equal(context.revelacao["13x18"].tier.id, "pro-16");
  assert.deepEqual(repriceItems(items, context).map((item) => [item.unitPrice, item.pricingTable]), [
    [9, "profissional"], [6.6, "profissional"], [3.8, "normal"], [6.3, "normal"],
  ]);
  assert.equal(pricingContext({ ...normal, counts }).revelacao["10x15"].unit, 1.5);
});

test("carrinho comum misto usa a soma de revelações e polaroides nas duas tabelas", () => {
  const counts = { revelacao: { "10x15": 13 }, polaroid: { mini: 3 } };
  const tiers = ["revelacao", "polaroid"].flatMap((category) => [
    { id: category + "15", category, min_qty: 1, max_qty: 15 },
    { id: category + "16", category, min_qty: 16, max_qty: 0 },
  ]);
  const tierPrices = [
    { tier_id: "revelacao16", size_id: "10x15", unit_price: 1.25 },
    { tier_id: "polaroid16", size_id: "mini", unit_price: 2.5 },
  ];
  const result = pricingContext({ tiers, tierPrices, counts });
  assert.equal(result.revelacao["10x15"].count, 16);
  assert.equal(result.revelacao["10x15"].unit, 1.25);
  assert.equal(result.polaroid.mini.count, 16);
  assert.equal(result.polaroid.mini.unit, 2.5);
});

test("a divisão por forma só oferece o provedor selecionado e ativo", () => {
  const settings = { ...storefront, payment_routing: { enabled: true, pix: "sicoob_pix", card: "infinitepay" } };
  const providers = ["sicoob_pix", "infinitepay", "pagarme"];
  assert.deepEqual(checkoutPaymentMethods({ settings, onlineEnabled: true, providers }), ["sicoob_pix", "infinitepay"]);
  assert.deepEqual(checkoutPaymentMethods({ settings, onlineEnabled: true, providers: providers.slice(1) }), ["infinitepay"]);
  assert.deepEqual(checkoutPaymentMethods({ settings: { ...settings, payment_routing: { enabled: true, pix: "pagarme", card: "sicoob_pix" } }, providers }), []);
});
