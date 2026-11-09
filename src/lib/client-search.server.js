import { ensureDatabase, getPool } from "@/lib/vps/db.server";

const PAGE_SIZE = 40;

export async function searchClients(term, offset, professional = false) {
  await ensureDatabase();
  const query = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
  const digits = /^[+\d\s().-]+$/.test(query) ? query.replace(/\D/g, "") : "";
  const phone = /^55\d{10,11}$/.test(digits) ? digits.slice(2) : digits;
  const { rows } = await getPool().query(
    `WITH matching AS (
      SELECT id, created_at, data
      FROM vps_records
      WHERE entity = 'User' AND (NOT $5::boolean OR data->'professional_pricing'='true'::jsonb) AND (
        $1 = ''
        OR strpos(regexp_replace(lower(regexp_replace(normalize(coalesce(data->>'full_name', ''), NFD), '[\u0300-\u036f]', '', 'g')), '[[:space:]]+', ' ', 'g'), $1) > 0
        OR strpos(lower(coalesce(data->>'email', '')), $1) > 0
        OR ($2 <> '' AND strpos(regexp_replace(coalesce(data->>'phone', ''), '[^0-9]', '', 'g'), $2) > 0)
      )
    ), page AS (
      SELECT * FROM matching ORDER BY created_at DESC, id LIMIT $3 OFFSET $4
    )
    SELECT
      (SELECT count(*)::int FROM matching) AS total,
      coalesce(json_agg(json_build_object(
        'id', p.id, 'full_name', p.data->>'full_name', 'email', p.data->>'email',
        'phone', p.data->>'phone', 'address', p.data->>'address', 'role', p.data->>'role',
        'professional_pricing', p.data->'professional_pricing', 'allow_pickup_payment', p.data->'allow_pickup_payment',
        'orderCount', totals.orders, 'spent', totals.spent
      ) ORDER BY p.created_at DESC, p.id) FILTER (WHERE p.id IS NOT NULL), '[]'::json) AS items
    FROM page p
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS orders,
        coalesce(sum((o.data->>'total')::numeric) FILTER (WHERE o.data->>'payment_status' = 'aprovado' AND jsonb_typeof(o.data->'total') = 'number'), 0) AS spent
      FROM vps_records o
      WHERE o.entity = 'Order' AND (
        o.data->>'customer_user_id' = p.id
        OR (coalesce(o.data->>'customer_user_id', '') = '' AND o.data->>'customer_email' = p.data->>'email')
      )
    ) totals ON true`,
    [query, phone, PAGE_SIZE, offset, professional],
  );
  const { total, items } = rows[0];
  return { total, items, nextOffset: offset + items.length < total ? offset + items.length : null };
}
