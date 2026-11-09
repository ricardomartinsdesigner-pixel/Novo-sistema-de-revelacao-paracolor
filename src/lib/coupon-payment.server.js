import { createHash } from "node:crypto";
import { getPool, withTransaction } from "./vps/db.server.js";
import { getMercadoPagoToken } from "./integrations.server.js";

export function paymentTokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

// Dá tempo para notificações e compensações iniciadas dentro da vigência.
const SETTLEMENT_GRACE_MS = 24 * 3_600_000;
const terminal = new Set(["cancelled", "rejected", "refunded", "charged_back"]);

async function cannotStillPay(orderId, token) {
  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  url.search = new URLSearchParams({ external_reference: orderId, sort: "date_created", criteria: "desc", limit: 50 });
  try {
    const response = await fetch(url, { headers: { authorization: "Bearer " + token }, signal: AbortSignal.timeout(3500) });
    if (!response.ok) return false;
    const result = await response.json();
    return Array.isArray(result.results) && Number.isInteger(result.paging?.total)
      && result.paging.total === result.results.length
      && result.results.every((payment) => payment.external_reference === orderId && terminal.has(payment.status));
  } catch {
    return false;
  }
}

export async function reconcileExpiredCouponPayments(couponId, role) {
  const db = getPool();
  const now = Date.now();
  const cutoff = new Date(now - SETTLEMENT_GRACE_MS).toISOString();
  const checkedBefore = new Date(now - 15 * 60_000).toISOString();
  const stamp = new Date(now).toISOString();
  const { rows: pending } = await db.query(`
    SELECT id, data->>'coupon_token_hash' AS token_hash FROM vps_records
    WHERE entity='Order' AND data->>'coupon_id'=$1 AND data->>'coupon_pay_by'<$2
      AND data->'coupon_payment_started'='true'::jsonb AND data ? 'coupon_token_hash'
      AND NOT (data ? 'coupon_released_at') AND data->>'payment_status' NOT IN ('aprovado','reembolsado')
      AND COALESCE(data->>'coupon_checked_at','')<$3
    ORDER BY data->>'coupon_pay_by', id LIMIT 4
  `, [couponId, cutoff, checkedBefore]);
  if (!pending.length) return;

  const token = await getMercadoPagoToken({ asServiceRole: role }, { includeDisabled: true });
  if (!token) return;
  const fingerprint = paymentTokenHash(token);
  await Promise.all(pending.filter((order) => order.token_hash === fingerprint).map(async ({ id }) => {
    const claimed = await db.query(`
      UPDATE vps_records SET data=data || jsonb_build_object('coupon_checked_at', $2::text)
      WHERE entity='Order' AND id=$1 AND COALESCE(data->>'coupon_checked_at','')<$3
    `, [id, stamp, checkedBefore]);
    if (!claimed.rowCount || !await cannotStillPay(id, token)) return;
    await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(74150, 1)");
      const event = { status: "cancelado", date: stamp, by: "automático", note: "Pagamento expirado. Reserva da campanha liberada." };
      await client.query(`
        UPDATE vps_records SET data=data || jsonb_build_object(
          'status','cancelado', 'payment_status','recusado', 'coupon_released_at',$2::text,
          'status_history', COALESCE(data->'status_history','[]'::jsonb) || $3::jsonb
        ), updated_at=now()
        WHERE entity='Order' AND id=$1 AND data->>'payment_status' NOT IN ('aprovado','reembolsado')
          AND NOT (data ? 'coupon_released_at')
      `, [id, stamp, JSON.stringify([event])]);
    });
  }));
}
