import { ART_PENDING_STATUSES, PRODUCTION_START_STATUSES } from "./order-production.js";
import { ORDER_TABS, orderStatuses, prioritizeDeadline } from "./admin-order-filters.js";
import { ensureDatabase, getPool } from "./vps/db.server.js";

function selection(filters) {
  const conditions = ["entity = 'Order'"];
  const params = [];
  const bind = (value) => {
    params.push(value);
    return '$' + params.length;
  };
  const statuses = orderStatuses(filters);
  if (statuses.length) conditions.push(`data->>'status' = ANY(${bind(statuses)}::text[])`);
  if (filters.payment !== "todos") conditions.push(`data->>'payment_status' = ${bind(filters.payment)}`);

  if (filters.search) {
    const text = bind(filters.search);
    const fields = ["order_number", "internal_number", "customer_name", "customer_email", "customer_cpf", "customer_phone"];
    const match = fields.map((field) => `strpos(lower(data->>'${field}'), lower(${text})) > 0`);
    const digits = filters.search.replace(/\D/g, "");
    if (digits.length >= 3 && /^[+\d().\-\s]+$/.test(filters.search)) {
      const normalized = bind(digits);
      match.push(`strpos(regexp_replace(data->>'customer_cpf', '[^0-9]', '', 'g'), ${normalized}) > 0`);
      match.push(`strpos(regexp_replace(data->>'customer_phone', '[^0-9]', '', 'g'), ${normalized}) > 0`);
    }
    conditions.push(`(${match.join(" OR ")})`);
  }

  const sort = prioritizeDeadline(filters)
    ? "NULLIF(data->>'quick_due_at', '') ASC NULLS LAST, created_at ASC, id ASC"
    : "created_at DESC, id DESC";
  return { where: conditions.join(" AND "), sort, params };
}

const orderColumns = `id, created_at AS created_date,
  data->>'order_number' AS order_number, data->>'internal_number' AS internal_number,
  data->>'customer_name' AS customer_name, data->>'customer_email' AS customer_email,
  data->>'status' AS status, data->>'payment_status' AS payment_status, data->>'total' AS total`;

const PAGE_SIZE = 25;

export async function listAdminOrders(filters, offset, viewerId = "") {
  await ensureDatabase();
  const { where, sort, params } = selection(filters);
  const viewerBind = `$${params.length + 1}`;
  const pageBind = `$${params.length + 2}`;
  const { rows } = await getPool().query(
    `SELECT ${orderColumns}, data->>'customer_cpf' AS customer_cpf, data->>'last_action_by' AS last_action_by,
       data->>'customer_user_id' AS customer_user_id, data->'customer_professional' AS customer_professional,
       data->>'pricing_table' AS pricing_table, data->>'quick_due_at' AS quick_due_at,
       EXISTS(SELECT 1 FROM vps_order_alerts a WHERE a.order_id=vps_records.id) AS has_order_alert,
       COALESCE((SELECT a.is_legacy FROM vps_order_alerts a WHERE a.order_id=vps_records.id), false) AS alert_is_legacy,
       (SELECT v.viewed_at FROM vps_order_views v JOIN vps_order_alerts a ON a.order_id=v.order_id
         WHERE v.order_id=vps_records.id AND v.user_id=${viewerBind} AND v.viewed_at >= a.created_at) AS alert_viewed_at,
       COALESCE((SELECT json_agg(json_build_object('user_id',v.user_id,'name',v.user_name,'viewed_at',v.viewed_at)
         ORDER BY v.viewed_at) FROM vps_order_views v JOIN vps_order_alerts a ON a.order_id=v.order_id
         WHERE v.order_id=vps_records.id AND v.viewed_at >= a.created_at), '[]'::json) AS alert_viewers,
       count(*) OVER () AS result_count
     FROM vps_records WHERE ${where} ORDER BY ${sort}
     LIMIT ${PAGE_SIZE} OFFSET ${pageBind}`,
    [...params, viewerId, offset],
  );
  const total = Number(rows[0]?.result_count ?? offset);
  return { total, nextOffset: offset + rows.length < total ? offset + rows.length : null, items: rows };
}

export async function listUnreadOrderAlerts(userId, limit = 20) {
  await ensureDatabase();
  const { rows } = await getPool().query(
    `SELECT a.order_id AS id, a.created_at AS alert_at, o.created_at AS created_date,
       o.data->>'order_number' AS order_number, o.data->>'internal_number' AS internal_number,
       o.data->>'customer_name' AS customer_name, o.data->>'customer_email' AS customer_email,
       o.data->>'customer_professional' AS customer_professional, o.data->>'payment_status' AS payment_status,
       o.data->>'payment_method' AS payment_method, o.data->>'status' AS status, o.data->>'total' AS total
     FROM vps_order_alerts a
     JOIN vps_records o ON o.entity='Order' AND o.id=a.order_id
     WHERE NOT a.is_legacy AND NOT EXISTS (
       SELECT 1 FROM vps_order_views v WHERE v.order_id=a.order_id AND v.user_id=$1 AND v.viewed_at >= a.created_at
     )
     ORDER BY a.created_at DESC, a.order_id
     LIMIT $2`,
    [userId, Math.max(1, Math.min(Number(limit) || 20, 100))],
  );
  const { rows: [count] = [] } = await getPool().query(
    `SELECT count(*)::int AS total FROM vps_order_alerts a
     JOIN vps_records o ON o.entity='Order' AND o.id=a.order_id
     WHERE NOT a.is_legacy
       AND NOT EXISTS (SELECT 1 FROM vps_order_views v WHERE v.order_id=a.order_id AND v.user_id=$1 AND v.viewed_at >= a.created_at)`,
    [userId],
  );
  return { items: rows, total: Number(count?.total) || 0 };
}

export async function markOrderAlertViewed(orderId, user) {
  await ensureDatabase();
  const { rows } = await getPool().query(
    `INSERT INTO vps_order_views(order_id, user_id, user_name)
     SELECT o.id, $2, $3 FROM vps_records o
     WHERE o.entity='Order' AND o.id=$1
       AND (o.data->>'status'=ANY($4::text[]) OR EXISTS(SELECT 1 FROM vps_order_alerts a WHERE a.order_id=o.id))
     ON CONFLICT(order_id, user_id) DO UPDATE SET user_name=EXCLUDED.user_name, viewed_at=clock_timestamp()
     RETURNING order_id, user_id, user_name, viewed_at`,
    [orderId, user.id, user.full_name || user.name || user.email || "Equipe", PRODUCTION_START_STATUSES],
  );
  return { viewed: rows.length > 0, view: rows[0] || null };
}

export async function exportAdminOrders(filters) {
  await ensureDatabase();
  const { where, sort, params } = selection(filters);
  const { rows } = await getPool().query(
    `SELECT ${orderColumns} FROM vps_records WHERE ${where} ORDER BY ${sort}`,
    params,
  );
  return rows;
}

export async function countAdminOrderTabs() {
  await ensureDatabase();
  const statuses = Object.values(ORDER_TABS).flatMap((tab) => tab.statuses);
  const { rows } = await getPool().query(
    `SELECT data->>'status' AS status, count(*) AS count FROM vps_records
     WHERE entity = 'Order' AND data->>'status' = ANY($1::text[]) GROUP BY 1`,
    [statuses],
  );
  const counts = new Map(rows.map((row) => [row.status, Number(row.count)]));
  return Object.fromEntries(Object.entries(ORDER_TABS).map(([key, tab]) => [
    key, tab.statuses.reduce((total, status) => total + (counts.get(status) ?? 0), 0),
  ]));
}

const PENDING_PAYMENT = "o.data->>'payment_status'='pendente' AND o.data->>'status' <> 'cancelado'";
const CAN_PRODUCE = `(o.data->>'payment_status'='aprovado' OR (
  o.data->>'payment_status'='pendente' AND o.data->'customer_professional'='true'::jsonb
  AND o.data->>'payment_method'='pagar_na_retirada' AND o.data->>'fulfillment'='retirada'
  AND o.data->>'status' <> 'enviado'))`;

const queueStatuses = {
  production: [...PRODUCTION_START_STATUSES, "em_producao", "aguardando_conferencia", "pronto"],
  deliveries: ["pronto", "enviado"],
};

export async function getProductionStart(userId = "") {
  await ensureDatabase();
  const { rows } = await getPool().query(
    `WITH start_orders AS (
       SELECT ${orderColumns},
         CASE WHEN data->>'art_approval_status' IS DISTINCT FROM 'aprovada'
           AND (data->>'art_approval_requested'='true' OR data->>'status'=ANY($2::text[]))
           THEN 'waiting' ELSE 'ready' END AS stage
       FROM vps_records o
       WHERE entity='Order' AND data->>'status'=ANY($1::text[]) AND ${CAN_PRODUCE}
         AND NOT EXISTS (SELECT 1 FROM vps_order_alerts a WHERE a.order_id=o.id AND NOT a.is_legacy)
         AND NOT EXISTS (
           SELECT 1 FROM vps_order_views v LEFT JOIN vps_order_alerts a ON a.order_id=v.order_id
           WHERE v.order_id=o.id AND v.user_id=$3
             AND (a.order_id IS NULL OR v.viewed_at >= a.created_at)
         )
     ), ranked AS (
       SELECT *, count(*) OVER (PARTITION BY stage) AS count,
         row_number() OVER (PARTITION BY stage ORDER BY created_date DESC, id DESC) AS position
       FROM start_orders
     ) SELECT * FROM ranked WHERE position <= 5 ORDER BY position`,
    [PRODUCTION_START_STATUSES, ART_PENDING_STATUSES, userId],
  );
  const result = { ready: { orders: [], total: 0 }, waiting: { orders: [], total: 0 } };
  for (const { stage, count, position: _position, ...order } of rows) {
    result[stage].orders.push(order);
    result[stage].total = Number(count);
  }
  return result;
}

export async function getPaymentTotals() {
  await ensureDatabase();
  const { rows } = await getPool().query(
    `SELECT o.data->>'payment_status' AS payment_status, count(*)::int AS count,
       COALESCE(sum(CASE WHEN o.data->>'total' ~ '^-?[0-9]+([.][0-9]+)?$' THEN (o.data->>'total')::numeric END), 0) AS sum_total
     FROM vps_records o WHERE entity='Order'
       AND (o.data->>'payment_status' <> 'pendente' OR (${PENDING_PAYMENT}))
     GROUP BY 1`,
  );
  return { rows };
}

export async function listOrderQueue(queue, search, offset) {
  await ensureDatabase();
  const payments = queue === "payments";
  const production = queue === "production";
  const conditions = payments ? PENDING_PAYMENT : `o.data->>'status'=ANY($1::text[]) AND ${CAN_PRODUCE}`;
  const { rows } = await getPool().query(
    `WITH page AS (
      SELECT o.id,o.data,o.created_at, count(*) OVER () AS total
      FROM vps_records o WHERE o.entity='Order'
        AND ($2='' OR strpos(lower(concat_ws(' ',o.data->>'internal_number',o.data->>'order_number',
           o.data->>'customer_name',o.data->>'customer_phone')),lower($2)) > 0)
        AND $1::text[] IS NOT NULL AND ${conditions}
      ORDER BY o.created_at ${payments ? "DESC" : "ASC"},o.id LIMIT 40 OFFSET $3
    )
    SELECT id,data,created_at,total ${production ? `,(
      SELECT COALESCE(sum(CASE WHEN p.data->>'copies' ~ '^[0-9]{1,8}$' THEN (p.data->>'copies')::int ELSE 1 END),0)
      FROM vps_records p WHERE p.entity='OrderPhoto' AND p.data->>'order_id'=page.id
    ) AS prints` : ""}
    FROM page ORDER BY created_at ${payments ? "DESC" : "ASC"},id`,
    [queueStatuses[queue] ?? [], search, offset],
  );
  const total = Number(rows[0]?.total ?? offset);
  return {
    total, nextOffset: offset + rows.length < total ? offset + rows.length : null,
    items: rows.map(({ id, data, created_at, prints }) => ({
      ...Object.fromEntries(["order_number","internal_number","customer_name","customer_professional","created_by_id",
        "shipping_address","shipping_cep","fulfillment","payment_status","payment_method","pricing_table","status",
        "art_approval_status","art_approval_requested",
        "total","quick_due_at","production_days","production_deadline_label","tracking_code","tracking_url"].map((key) => [key, data[key]])),
      id, created_date: created_at.toISOString(), prints: Number(prints) || 0,
    })),
  };
}
