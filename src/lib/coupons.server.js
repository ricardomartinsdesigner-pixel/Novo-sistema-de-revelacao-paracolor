import { reconcileExpiredCouponPayments } from "./coupon-payment.server.js";
import { getPool } from "./vps/db.server.js";
import { campaignStatus, discountForCampaign, normalizeCoupon } from "./coupon-rules.js";

const couponSelect = "SELECT id, data FROM vps_records WHERE entity = 'Coupon'";
// Aprovação consome a vaga. Pedidos pendentes reservam até o prazo de início do pagamento.
// Uma cobrança já aberta continua reservada enquanto houver chance de confirmação.
const holdsCoupon = `(
  data->>'payment_status' = 'aprovado' OR (
    COALESCE(data->>'payment_status', '') <> 'reembolsado' AND (
      (data->'coupon_payment_started' = 'true'::jsonb AND NOT (data ? 'coupon_released_at')) OR
      (COALESCE(data->>'status', '') <> 'cancelado' AND
        COALESCE(NULLIF(data->>'coupon_pay_by', ''), '9999') > $3)
    )
  )
)`;

export function lockCampaigns(db) {
  return db.query("SELECT pg_advisory_xact_lock(74150, 1)");
}

async function candidates(db, code, automatic) {
  if (!code && !automatic) return [];
  const { rows } = code
    ? await db.query(`${couponSelect} AND UPPER(TRIM(data->>'code')) = $1 ORDER BY created_at DESC, id`, [code])
    : await db.query(`${couponSelect} AND data->>'campaign_mode' = 'automatico' AND data->'active' = 'true'::jsonb ORDER BY created_at DESC, id`);
  return rows.map(({ id, data }) => ({ ...data, id }));
}

export async function campaignUsage(db, coupon, customerId, now = new Date().toISOString()) {
  const { rows: [result] } = await db.query(`
    SELECT COUNT(*) FILTER (WHERE ${holdsCoupon})::int AS used,
      COUNT(*) FILTER (WHERE ${holdsCoupon} AND created_by_id = $4)::int AS customer,
      COUNT(*) FILTER (WHERE data->>'payment_status' = 'aprovado')::int AS paid,
      COALESCE(SUM(CASE WHEN data->>'payment_status' = 'aprovado'
        AND (data->>'discount') ~ '^[0-9]+([.][0-9]+)?$' THEN (data->>'discount')::numeric ELSE 0 END), 0)::float8 AS discount
    FROM vps_records
    WHERE entity = 'Order' AND (
      data->>'coupon_id' = $1 OR
      (NOT (data ? 'coupon_id') AND UPPER(TRIM(data->>'coupon_code')) = $2)
    )
  `, [coupon.id, normalizeCoupon(coupon.code), now, customerId ?? ""]);
  return result;
}

function limitReached(coupon, usage) {
  return (coupon.max_uses > 0 && usage.used >= coupon.max_uses)
    || (coupon.per_customer > 0 && usage.customer >= coupon.per_customer);
}

export async function resolveCampaign({ rawCode, items, settings, user, transaction, role }) {
  const code = normalizeCoupon(rawCode);
  const automatic = settings.module_promocoes !== false;
  const db = transaction ?? getPool();
  let coupons = await candidates(db, code, automatic);
  if (coupons.length && transaction) {
    await lockCampaigns(transaction);
    coupons = await candidates(db, code, automatic);
  }
  let best = null;
  let reason = "Cupom indisponível para esta conta ou fora da validade.";
  for (const coupon of coupons) {
    if (code && coupon.campaign_mode === "automatico") continue;
    const result = discountForCampaign(coupon, items, user);
    if (!result.discount) {
      reason = result.reason;
      continue;
    }
    if (coupon.max_uses > 0 || coupon.per_customer > 0) {
      let usage = await campaignUsage(db, coupon, user?.id);
      if (limitReached(coupon, usage) && !transaction && user?.id) {
        await reconcileExpiredCouponPayments(coupon.id, role);
        usage = await campaignUsage(db, coupon, user.id);
      }
      if (limitReached(coupon, usage)) {
        reason = "Este cupom atingiu o limite de utilizações.";
        continue;
      }
    }
    if (!best || result.discount > best.discount) {
      best = { coupon, discount: result.discount, label: coupon.title || coupon.code };
    }
    if (code) break;
  }
  if (code && !best) throw new Error(reason);
  return best;
}

function presentation(coupon) {
  return {
    id: coupon.id, title: coupon.title || coupon.code, code: coupon.campaign_mode === "automatico" ? "" : coupon.code,
    mode: coupon.campaign_mode, value: coupon.value, type: coupon.type, min_total: coupon.min_total,
    min_quantity: coupon.min_quantity, max_discount: coupon.max_discount, area: coupon.area,
    product_name: coupon.product_name, ends_at: coupon.ends_at, notice: coupon.notice,
    message: coupon.message, image_url: coupon.image_url, allow_professional: coupon.allow_professional,
  };
}

export async function visibleCampaigns(db, userId, role) {
  const { rows } = userId
    ? await db.query(`${couponSelect} AND data->>'campaign_mode' = 'exclusivo' AND data->>'customer_id' = $1 ORDER BY created_at DESC`, [userId])
    : await db.query(`${couponSelect} AND data->>'campaign_mode' IN ('publico', 'automatico')
      AND data->>'notice' IN ('banner', 'popup') ORDER BY created_at DESC, id`);
  const visible = [];
  for (const { id, data } of rows) {
    const coupon = { ...data, id };
    if (campaignStatus(coupon) !== "Ativo") continue;
    if (coupon.max_uses > 0 || coupon.per_customer > 0) {
      let usage = await campaignUsage(db, coupon, userId);
      if (userId && role && limitReached(coupon, usage)) {
        await reconcileExpiredCouponPayments(coupon.id, role);
        usage = await campaignUsage(db, coupon, userId);
      }
      if (limitReached(coupon, usage)) continue;
    }
    visible.push(presentation(coupon));
  }
  return visible;
}

export async function hasAutomaticCampaign(db) {
  const coupons = await candidates(db, "", true);
  return coupons.some((coupon) => campaignStatus(coupon) === "Ativo");
}

// A validade do cupom é conferida no checkout. Aqui vence apenas a reserva de um pedido
// online que ainda não iniciou o pagamento. Depois disso, uma confirmação pode chegar tarde.
export function checkCouponPaymentDeadline(order, openingOnlinePayment = false) {
  if (order.coupon_released_at || (order.coupon_pay_by && (openingOnlinePayment || !order.coupon_payment_started) && Date.parse(order.coupon_pay_by) <= Date.now())) {
    throw new Error("A reserva do desconto expirou. Refaça o pedido para conferir a oferta atual.");
  }
}
