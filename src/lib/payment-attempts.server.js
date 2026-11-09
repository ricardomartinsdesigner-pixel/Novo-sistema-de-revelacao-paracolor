import { randomUUID } from "node:crypto";
import { getPool, ensureDatabase, withTransaction } from "./vps/db.server.js";
import { makeEntityService } from "./vps/entities.server.js";
import { lockCampaigns, checkCouponPaymentDeadline } from "./coupons.server.js";
import { createProviderCharge, onlineCents, verifyProviderCharge } from "./payment-adapters.server.js";
import { expectedPaymentMode, paymentWebhookUrl, publicPaymentBase, readPaymentProviders } from "./payment-provider-config.server.js";
import { privateToken, sameToken, securityKeyConfigured } from "./security-secrets.server.js";
import { enqueueOrderNotice, sendPendingOrderNotices } from "./order-notices.server.js";
import { isNewOnlinePayment } from "./payment-providers.js";

async function attemptFor(db, id, lock = false) {
  const { rows: [row] } = await db.query(
    "SELECT data FROM vps_records WHERE entity='PaymentAttempt' AND id=$1" + (lock ? " FOR UPDATE" : ""), [id],
  );
  return row?.data;
}

async function updateAttempt(db, id, patch) {
  await db.query("UPDATE vps_records SET data=data || $2::jsonb, updated_at=now() WHERE entity='PaymentAttempt' AND id=$1", [id, patch]);
}

function publicCharge(attempt, order) {
  if (!attempt) return { state: order.payment_status };
  const expired = Date.parse(attempt.expiresAt) <= Date.now();
  return {
    state: order.payment_status,
    expiresAt: attempt.expiresAt, expired,
    inReview: attempt.phase !== "ready",
    ...(!expired && order.status !== "cancelado" && !["aprovado", "reembolsado", "teste_aprovado"].includes(order.payment_status)
      ? { code: attempt.code, init_point: attempt.url } : {}),
  };
}

async function lockOrder(db, id) {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 1))", [id]);
}

async function reserveAttempt(user, orderId) {
  return withTransaction(async (db) => {
    await lockCampaigns(db);
    await lockOrder(db, orderId);
    const orders = makeEntityService(user, true, db).entities.Order;
    const order = await orders.get(orderId);
    if (order.created_by_id !== user.id && user.role !== "admin") throw new Error("Sem permissão para este pedido.");
    if (!isNewOnlinePayment(order.payment_method)) throw new Error("Provedor indisponível para este pedido.");
    if (order.status === "cancelado" || ["aprovado", "reembolsado", "teste_aprovado"].includes(order.payment_status)) {
      throw new Error("Este pedido não pode receber um novo pagamento.");
    }
    const previous = await attemptFor(db, order.id, true);
    if (previous) return { attempt: previous, order, create: false };
    checkCouponPaymentDeadline(order, true);
    const amount = onlineCents(order.total);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("O total do pedido precisa ser conferido pela loja.");
    const config = (await readPaymentProviders(db)).find((row) => row.id === order.payment_method);
    if (!config?.enabled || !config.tested || !expectedPaymentMode(config) || !securityKeyConfigured()) {
      throw new Error("Este provedor está indisponível para novas cobranças.");
    }
    const base = publicPaymentBase();
    const ref = randomUUID().replaceAll("-", "");
    const expiresAt = new Date(Math.min(Date.now() + (config.id === "sicoob_pix" ? 30 * 60_000 : 24 * 3_600_000),
      order.coupon_pay_by ? Date.parse(order.coupon_pay_by) : Infinity)).toISOString();
    const attempt = {
      provider: config.id, ref, amount, expiresAt, phase: "starting", config,
      checkAfter: new Date(Date.now() + 30_000).toISOString(),
    };
    await db.query("INSERT INTO vps_records(entity,id,created_by_id,data) VALUES('PaymentAttempt',$1,$2,$3)", [order.id, order.created_by_id, attempt]);
    if (order.coupon_pay_by) await orders.update(order.id, { coupon_payment_started: true });
    return { attempt, order, create: true, base };
  });
}

export async function openProviderPayment(user, orderId) {
  const { attempt, order, create, base } = await reserveAttempt(user, orderId);
  if (!create) return { configured: true, ...publicCharge(attempt, order) };
  try {
    const webhook = attempt.provider === "infinitepay" ? paymentWebhookUrl("infinitepay", order.id) : undefined;
    const charge = await createProviderCharge(attempt.config, attempt, order, { base, webhook });
    const ready = { ...charge, phase: "ready" };
    await updateAttempt(getPool(), order.id, ready);
    return { configured: true, ...publicCharge({ ...attempt, ...ready }, order) };
  } catch {
    // Uma resposta perdida pode esconder uma cobrança efetivamente criada. Preserve a referência
    // e não dispare outro POST. O Sicoob é consultado pelo txid mesmo nessa situação.
    await updateAttempt(getPool(), order.id, { phase: "review" });
    return { configured: true, ...publicCharge({ ...attempt, phase: "review" }, order),
      message: "A criação da cobrança está em conferência. Acompanhe o pedido." };
  }
}

async function registerVerified(base44, id, attempt, result) {
  if (!result) return;
  const approvedOrder = await withTransaction(async (db) => {
    await lockCampaigns(db);
    await lockOrder(db, id);
    const current = await attemptFor(db, id, true);
    if (!current || current.ref !== attempt.ref) return null;
    const orders = makeEntityService(null, true, db).entities.Order;
    const order = await orders.get(id);
    if (order.payment_method !== current.provider) return null;
    const { state, transaction, code } = result;
    if (order.payment_status === "reembolsado" || order.payment_status === "teste_aprovado" ||
        (order.payment_status === "aprovado" && (state !== "reembolsado" || transaction !== current.transaction))) return null;
    if (state === "reembolsado" && current.transaction && transaction !== current.transaction) return null;
    if (code) await updateAttempt(db, id, { code, phase: "ready" });
    if (state === "pendente" || state === order.payment_status) return null;

    const approved = state === "aprovado";
    const live = current.config.mode === "producao";
    const pixEnded = state === "recusado" && current.provider === "sicoob_pix";
    const status = approved && live && order.status === "aguardando_pagamento" ? "pagamento_aprovado"
      : pixEnded && order.status === "aguardando_pagamento" ? "cancelado" : order.status;
    const when = new Date().toISOString();
    const stateForOrder = approved && !live ? "teste_aprovado" : state;
    if (order.payment_status === stateForOrder) return null;
    const patch = {
      payment_status: stateForOrder, status,
      ...(approved && live ? { payment_approved_at: when } : {}),
      ...(transaction ? { payment_reference: transaction } : {}),
      ...(pixEnded && order.coupon_pay_by ? { coupon_released_at: when } : {}),
      status_history: [...(order.status_history ?? []), {
        status, date: when, by: current.provider,
        note: approved && !live ? "Pagamento de homologação. Pedido sem liberação para produção."
          : approved && order.status === "cancelado" ? "Pagamento recebido após cancelamento. Confira o pedido."
          : state === "reembolsado" ? "Estorno integral confirmado pelo provedor."
          : approved ? "Pagamento online confirmado pelo provedor." : "Cobrança recusada ou removida pelo provedor.",
      }],
    };
    const updated = await orders.update(id, patch);
    if (transaction && (approved || state === "reembolsado")) await updateAttempt(db, id, { transaction });
    if (approved && live && status === "pagamento_aprovado") await enqueueOrderNotice(db, id, "payment_approved");
    return updated;
  });
  if (approvedOrder) void sendPendingOrderNotices(base44).catch(() => {});
}

function pollingTime(attempt) {
  return new Date(Date.now() + (Date.parse(attempt.expiresAt) < Date.now() ? 15 * 60_000 : 45_000)).toISOString();
}

export async function refreshProviderPayment(base44, order, details = {}, { scheduled = false, webhook = false } = {}) {
  const db = getPool();
  const attempt = await attemptFor(db, order.id);
  if (!attempt || attempt.provider !== order.payment_method) return publicCharge(null, order);
  if (webhook || (Date.parse(attempt.checkAfter) <= Date.now() && (attempt.provider === "sicoob_pix" || attempt.transaction || details.transaction))) {
    const next = pollingTime(attempt);
    const claimed = webhook || (await db.query(
      `UPDATE vps_records SET data=data || jsonb_build_object('checkAfter',$3::text)
       WHERE entity='PaymentAttempt' AND id=$1 AND data->>'checkAfter'<=$2`,
      [order.id, new Date().toISOString(), next],
    )).rowCount;
    if (claimed) {
      let result;
      try { result = await verifyProviderCharge(attempt.config, attempt, details); }
      catch { if (webhook) throw new Error("Provedor indisponível para conferir o evento."); }
      if (result) await registerVerified(base44, order.id, attempt, result);
      if (scheduled) return;
      const latest = await base44.asServiceRole.entities.Order.get(order.id);
      return publicCharge(await attemptFor(db, order.id), latest);
    }
  }
  return publicCharge(attempt, order);
}

export function paymentCallbackAuthorized(provider, search) {
  const id = provider === "infinitepay" ? search.get("pedido") || "" : "";
  if (provider === "infinitepay" && !/^[a-f0-9-]{36}$/i.test(id)) return false;
  return sameToken(search.get("chave"), privateToken(`payment-hook:${provider}:${id}`));
}

export async function processPaymentCallback(base44, provider, body, search) {
  let id;
  let details;
  const data = body.data ?? body;
  if (provider === "infinitepay") {
    id = search.get("pedido") || "";
    const attempt = await attemptFor(getPool(), id);
    if (!attempt || attempt.ref !== data.order_nsu) return 200;
    details = { ref: data.order_nsu, transaction: data.transaction_nsu, slug: data.slug, recoverFromWebhook: true };
  } else {
    if (!/^order\.(paid|canceled|payment_failed|updated)$/.test(String(body.type || ""))) return 200;
    const link = data.payment_link_id || data.payment_link?.id || "";
    const ref = (Array.isArray(data.items) ? data.items : []).map((item) => String(item?.description || item?.name || "").match(/\[([a-f0-9]{32})\]$/)?.[1]).find(Boolean) || "";
    if (!link && !ref) return 200;
    const { rows: [match] } = await getPool().query(
      `SELECT id FROM vps_records WHERE entity='PaymentAttempt' AND data->>'provider'='pagarme'
       AND (($1<>'' AND data->>'remoteId'=$1) OR ($2<>'' AND data->>'ref'=$2)) LIMIT 1`, [link, ref],
    );
    if (!match) return 200;
    id = match.id;
    details = { transaction: data.id };
  }
  const order = await base44.asServiceRole.entities.Order.get(id);
  if (order.payment_method !== provider) return 200;
  await refreshProviderPayment(base44, order, details, { webhook: true });
  return 200;
}

export async function pollSicoobPayments(base44) {
  if (!securityKeyConfigured()) return;
  await ensureDatabase();
  const { rows } = await getPool().query(
    `SELECT a.id, o.data FROM vps_records a JOIN vps_records o ON o.entity='Order' AND o.id=a.id
     WHERE a.entity='PaymentAttempt' AND a.data->>'provider'='sicoob_pix'
       AND a.data->>'checkAfter'<=$1 AND a.data->>'expiresAt'>=$2
       AND o.data->>'payment_status' NOT IN ('reembolsado','teste_aprovado','recusado')
     ORDER BY a.data->>'checkAfter' LIMIT 20`,
    [new Date().toISOString(), new Date(Date.now() - 7 * 86_400_000).toISOString()],
  );
  for (let i = 0; i < rows.length; i += 4) {
    await Promise.allSettled(rows.slice(i, i + 4).map(({ id, data }) =>
      refreshProviderPayment(base44, { ...data, id }, {}, { scheduled: true })
    ));
  }
}
