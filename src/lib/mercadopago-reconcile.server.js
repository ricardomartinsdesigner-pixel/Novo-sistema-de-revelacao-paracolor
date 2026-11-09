import { getMercadoPagoToken } from "./integrations.server.js";
import { lockCampaigns } from "./coupons.server.js";
import { enqueueOrderNotice, sendPendingOrderNotices } from "./order-notices.server.js";
import { ONLINE_PAYMENT } from "./order-payment.js";
import { withTransaction } from "./vps/db.server.js";
import { makeEntityService } from "./vps/entities.server.js";

const api = "https://api.mercadopago.com/v1/payments";
const cents = (value) => Math.round(Number(value) * 100);
const refundable = ["refunded", "charged_back"];

export async function lookupMercadoPago(url, token) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("O Mercado Pago não confirmou a consulta.");
  return response.json();
}

export async function applyMercadoPago(base44, payment, token) {
  if (typeof payment.live_mode !== "boolean" || payment.live_mode === token.startsWith("TEST-")) {
    return { ok: false, reason: "credential_mode_mismatch" };
  }
  const id = payment.external_reference;
  if (!id || !/^\d+$/.test(String(payment.id))) return { ok: true, ignored: true };
  const result = await withTransaction(async (db) => {
    await lockCampaigns(db);
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 1))", [id]);
    const orders = makeEntityService(null, true, db).entities.Order;
    const order = await orders.get(id).catch((error) => {
      if (error.status !== 404) throw error;
    });
    if (!order || order.payment_method !== ONLINE_PAYMENT) return { ok: true, ignored: true };
    if (payment.currency_id !== "BRL" || !(cents(order.total) > 0) || cents(payment.transaction_amount) !== cents(order.total)) {
      return { ok: false, reason: "amount_mismatch", state: order.payment_status };
    }
    const paid = payment.status === "approved";
    const refunded = refundable.includes(payment.status);
    const transaction = String(payment.id);
    if (["reembolsado", "teste_aprovado"].includes(order.payment_status) || (order.payment_status === "aprovado" &&
        (!refunded || order.payment_reference !== transaction))) {
      return { ok: true, ignored: true, state: order.payment_status };
    }
    const rejected = ["rejected", "cancelled"].includes(payment.status);
    const state = paid ? (payment.live_mode ? "aprovado" : "teste_aprovado")
      : refunded ? "reembolsado" : rejected ? "recusado" : "pendente";
    if ((order.coupon_released_at && !paid && !refunded) || (state === order.payment_status && transaction === order.payment_reference)) {
      return { ok: true, state: order.payment_status };
    }
    const canAdvance = state === "aprovado" && !order.coupon_released_at && order.status === "aguardando_pagamento";
    const now = new Date().toISOString();
    await orders.update(id, {
      payment_reference: transaction, payment_status: state,
      ...(canAdvance ? { status: "pagamento_aprovado" } : {}),
      ...(state === "aprovado" ? {
        payment_approved_at: Number.isFinite(Date.parse(payment.date_approved)) ? new Date(payment.date_approved).toISOString() : now,
      } : {}),
      status_history: [...(order.status_history ?? []), {
        status: canAdvance ? "pagamento_aprovado" : order.status, date: now, by: "mercadopago",
        note: state === "teste_aprovado" ? "Pagamento de teste. Produção bloqueada."
          : state === "aprovado" && !canAdvance ? "Pagamento confirmado. Confira a situação do pedido antes de liberar."
          : `Mercado Pago · ${state}`,
      }],
    });
    if (canAdvance) await enqueueOrderNotice(db, id, "payment_approved");
    return { ok: true, state };
  });
  void sendPendingOrderNotices(base44).catch(() => {});
  return result;
}

export async function consultMercadoPago(base44, order) {
  const token = await getMercadoPagoToken(base44, { includeDisabled: true });
  if (!token) throw new Error("Configure as credenciais do Mercado Pago para consultar a cobrança.");
  const url = new URL(api + "/search");
  url.search = new URLSearchParams({
    sort: "date_created", criteria: "desc", external_reference: order.id,
    range: "date_created", begin_date: "NOW-365DAYS", end_date: "NOW", limit: "30",
  });
  const { results } = await lookupMercadoPago(url, token);
  const linked = (Array.isArray(results) ? results : []).filter((payment) => payment.external_reference === order.id);
  const matching = linked.filter((payment) => payment.currency_id === "BRL" && cents(payment.transaction_amount) === cents(order.total));
  if (linked.length && !matching.length) throw new Error("O valor retornado pelo Mercado Pago difere do pedido.");
  const transaction = matching.find((payment) => order.payment_status === "aprovado" && String(payment.id) === order.payment_reference)
    || matching.find((payment) => payment.status === "approved") || matching[0];
  if (!transaction) return { state: order.payment_status };
  const result = await applyMercadoPago(base44, transaction, token);
  if (!result.ok) throw new Error("O Mercado Pago retornou um pagamento que precisa ser conferido.");
  return { state: result.state ?? order.payment_status };
}
