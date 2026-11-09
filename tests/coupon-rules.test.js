import assert from "node:assert/strict";
import test from "node:test";
import { campaignStatus, discountForCampaign } from "../src/lib/coupon-rules.js";

const line = (area, ref_id, line_total, qty, pricing_table, product_promo = false) => ({
  input: { area, ref_id, options: { pricing_table } }, line_total, qty, product_promo,
});
const privateCoupon = {
  active: true, campaign_mode: "exclusivo", customer_id: "customer", type: "percent", value: 20,
  area: "revelacao", product_id: "10x15", min_quantity: 10, min_total: 30, max_discount: 5,
  starts_at: "2026-11-08T09:00", ends_at: "2026-11-08T18:00",
};
const now = Date.parse("2026-11-08T15:00:00Z");

test("cupom exclusivo valida a conta e limita o desconto à quantidade e ao subtotal elegíveis", () => {
  const lines = [line("revelacao", "10x15", 40, 12), line("revelacao", "13x18", 90, 15)];
  assert.deepEqual(discountForCampaign(privateCoupon, lines, { id: "customer" }, now), { discount: 5 });
  assert.match(discountForCampaign(privateCoupon, lines, { id: "outra" }, now).reason, /conta/);
  assert.match(discountForCampaign(privateCoupon, [line("revelacao", "10x15", 40, 8), ...lines.slice(1)], { id: "customer" }, now).reason, /quantidade mínima/);
});

test("campanhas respeitam a agenda da loja e a validade dos cupons antigos", () => {
  assert.equal(campaignStatus(privateCoupon, Date.parse("2026-11-08T11:59:59Z")), "Agendado");
  assert.equal(campaignStatus(privateCoupon, Date.parse("2026-11-08T21:00:59.999Z")), "Ativo");
  assert.equal(campaignStatus(privateCoupon, Date.parse("2026-11-08T21:01:00Z")), "Vencido");
  assert.equal(campaignStatus({ ...privateCoupon, ends_at: "2026-02-30T10:00" }, now), "Vencido");
  assert.equal(campaignStatus({ active: true, expires_at: "2026-11-08" }, Date.parse("2026-11-09T02:59:59Z")), "Ativo");
});

test("combinar desconto de campanha com tabela profissional ou promoção exige autorização", () => {
  const promotion = { active: true, campaign_mode: "automatico", type: "percent", value: 10 };
  const lines = [line("revelacao", "10x15", 20, 5, "profissional"), line("personalizado", "caneca", 30, 1, "normal", true)];
  assert.match(discountForCampaign(promotion, lines, {}, now).reason, /cumulativo/);
  assert.deepEqual(discountForCampaign({ ...promotion, allow_professional: true }, lines, {}, now), { discount: 2 });
  assert.deepEqual(discountForCampaign({ active: true, type: "percent", value: 10 }, lines, {}, now), { discount: 5 });
});
