import { ensureDatabase, getPool } from "./vps/db.server.js";

function numericField(alias, key) {
  const field = `${alias}.data->>'${key}'`;
  return `CASE WHEN (${field}) ~ '^-?[0-9]+([.][0-9]+)?$' THEN (${field})::numeric END`;
}

export async function adminSales(days, basis = "pedido", { from = null, to = null, offset = 0, limit = null, details = false } = {}) {
  await ensureDatabase();
  const { rows: [result] } = await getPool().query(`
    WITH clock AS (
      SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today
    ), bounds AS (
      SELECT COALESCE($3::date, today - ($1::int - 1)) AS first_day, COALESCE($4::date, today) AS last_day FROM clock
    ), all_orders AS (
      SELECT o.id, o.created_at, (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
        o.data->>'status' AS status, o.data->>'payment_status' AS payment_status,
        o.data->>'order_number' AS order_number, o.data->>'customer_name' AS customer_name,
        o.data->>'fulfillment' AS fulfillment, o.data->>'quick_due_at' AS quick_due_at,
        o.data AS order_data, ${numericField("o", "total")} AS total,
        ${numericField("o", "subtotal")} AS subtotal, ${numericField("o", "discount")} AS discount,
        ${numericField("o", "shipping_cost")} AS shipping
      FROM vps_records o WHERE o.entity = 'Order'
    ), orders AS (
      SELECT * FROM all_orders o CROSS JOIN bounds b
      WHERE o.created_at >= (b.first_day::timestamp AT TIME ZONE 'America/Sao_Paulo')
        AND o.created_at < ((b.last_day + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    ), payments AS (
      SELECT o.id,o.total,COALESCE(NULLIF(o.order_data->>'payment_approved_at',''),(
        SELECT min(event->>'date') FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(o.order_data->'status_history')='array'
            THEN o.order_data->'status_history' ELSE '[]'::jsonb END
        ) event WHERE event->>'status'='pagamento_aprovado'
      )) AS received_at
      FROM all_orders o WHERE o.payment_status='aprovado'
    ), receipt_days AS (
      SELECT id,total, (received_time AT TIME ZONE 'America/Sao_Paulo')::date AS day
      FROM (
        SELECT id,total,CASE WHEN received_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9:]+)$'
          AND pg_input_is_valid(received_at, 'timestamp with time zone') THEN received_at::timestamptz END AS received_time
        FROM payments
      ) validated WHERE received_time IS NOT NULL
    ), paid AS (
      SELECT id, day, total FROM orders WHERE $2='pedido' AND payment_status = 'aprovado'
      UNION ALL
      SELECT r.id,r.day,r.total FROM receipt_days r CROSS JOIN bounds b
      WHERE $2='recebimento' AND r.day BETWEEN b.first_day AND b.last_day
    ), detail_orders AS (
      SELECT id,created_at,day AS reference_day,status,payment_status,order_number,customer_name,subtotal,discount,shipping,total
      FROM orders WHERE $7::boolean AND $2='pedido'
      UNION ALL
      SELECT o.id,o.created_at,p.day,o.status,o.payment_status,o.order_number,o.customer_name,o.subtotal,o.discount,o.shipping,o.total
      FROM paid p JOIN all_orders o USING(id) WHERE $7::boolean AND $2='recebimento'
    ), detail_page AS (
      SELECT * FROM detail_orders ORDER BY reference_day DESC, created_at DESC,id DESC LIMIT $6 OFFSET $5
    ), paid_items AS (
      SELECT i.id, p.id AS order_id, i.data->>'area' AS area,
        ${numericField("i", "qty")} AS qty, ${numericField("i", "line_total")} AS line_total
      FROM vps_records i JOIN paid p ON p.id = i.data->>'order_id'
      WHERE i.entity = 'OrderItem'
    ), area_totals AS (
      SELECT COALESCE(NULLIF(area, ''), 'outros') AS area, COUNT(*) AS count, COALESCE(SUM(line_total), 0) AS subtotal
      FROM paid_items GROUP BY 1
    ), status_totals AS (
      SELECT status, COUNT(*) AS count FROM orders WHERE status IS NOT NULL GROUP BY status
    ), daily_totals AS (
      SELECT day, SUM(total) AS total FROM paid GROUP BY day
    ), days AS (
      SELECT b.first_day + series.day_offset AS day
      FROM bounds b CROSS JOIN generate_series(0, b.last_day - b.first_day) AS series(day_offset)
      WHERE NOT $7::boolean
    ), photo_items AS (
      -- A quantidade do item conserva as cópias mesmo depois da limpeza das fotos.
      SELECT id, order_id, area, qty FROM paid_items
      WHERE area IN ('revelacao', 'polaroid') AND qty > 0
    ), legacy_copies AS (
      SELECT SUM(GREATEST(COALESCE(${numericField("f", "copies")}, 1), 1)) AS copies
      FROM vps_records f JOIN paid p ON p.id = f.data->>'order_id'
      WHERE f.entity = 'OrderPhoto' AND f.data->>'area' IN ('revelacao', 'polaroid')
        AND NOT EXISTS (
          SELECT 1 FROM photo_items i WHERE i.order_id = p.id AND (
            i.id = f.data->>'item_id' OR
            (NULLIF(f.data->>'item_id', '') IS NULL AND i.area = f.data->>'area')
          )
        )
    )
    SELECT
      (SELECT COUNT(*)::int FROM orders) AS "orderCount",
      (SELECT jsonb_build_object('from',first_day,'to',last_day) FROM bounds) AS "period",
      (SELECT COUNT(*)::int FROM detail_orders) AS "detailCount",
      COALESCE((SELECT jsonb_agg(to_jsonb(detail_page) ORDER BY reference_day DESC, created_at DESC, id DESC) FROM detail_page), '[]'::jsonb) AS "details",
      (SELECT COALESCE(SUM(o.discount),0)::double precision FROM paid p JOIN all_orders o USING(id)) AS "discounts",
      (SELECT COALESCE(SUM(o.shipping),0)::double precision FROM paid p JOIN all_orders o USING(id)) AS "shipping",
      (SELECT count(*)::int FROM all_orders WHERE status='em_producao'
        AND nullif(quick_due_at,'') < to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) AS "overdue",
      (SELECT count(*)::int FROM all_orders WHERE status='pronto' AND fulfillment='retirada') AS "readyPickup",
      (SELECT count(*)::int FROM all_orders WHERE payment_status='pendente' AND status <> 'cancelado') AS "pendingPayment",
      (SELECT count(*)::int FROM payments) - (SELECT count(*)::int FROM receipt_days) AS "undatedReceipts",
      (SELECT COUNT(*)::int FROM paid) AS "paidCount",
      (SELECT COALESCE(SUM(total), 0)::double precision FROM paid) AS "revenue",
      ((SELECT COALESCE(SUM(qty), 0) FROM photo_items) + COALESCE((SELECT copies FROM legacy_copies), 0))::double precision AS "photoCopies",
      COALESCE((SELECT jsonb_object_agg(status, count) FROM status_totals), '{}'::jsonb) AS "statuses",
      COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY subtotal DESC, area) FROM area_totals a), '[]'::jsonb) AS "areas",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d.day, 'total', COALESCE(t.total, 0)) ORDER BY d.day)
        FROM days d LEFT JOIN daily_totals t USING (day)), '[]'::jsonb) AS "daily",
      COALESCE((SELECT jsonb_agg(to_jsonb(recent) ORDER BY created_date DESC, id DESC)
        FROM (SELECT id, order_number, customer_name, status, total, created_at AS created_date
              FROM orders ORDER BY created_at DESC, id DESC LIMIT 6) recent), '[]'::jsonb) AS "recent"
  `, [days, basis, from, to, offset, limit, details]);
  return result;
}
