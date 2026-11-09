import { getPool, ensureDatabase, randomUUID, safeUser } from "./db.server";
import { hasStaffAccess } from "../staff-access";
import { compileEntityQuery, entityDataExpression } from "./entity-query.js";

const publicRead = new Set([
  "BannerOption", "BannerSize", "CustomProduct", "Frame", "GalleryItem", "MagnetProduct", "PhotoSize",
  "PolaroidModel", "PriceGroup", "PromoBanner", "QuantityTier", "Service", "Settings", "SiteContent",
  "StudioGallery", "StudioPhoto", "Testimonial", "TierPrice",
]);
const ownerRead = new Set(["Order", "OrderItem", "OrderPhoto"]);

const jsonCopy = (x) => JSON.parse(JSON.stringify(x ?? {}));
const fields = (row) => ({ ...row.data, id: row.id, created_date: row.created_at?.toISOString?.() ?? row.created_at, updated_date: row.updated_at?.toISOString?.() ?? row.updated_at, created_by_id: row.created_by_id });
const resultArray = (result) => (Array.isArray(result) ? result : result?.items ?? []);
const getPath = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);

function compare(actual, expected) {
  if (expected && typeof expected === "object" && !Array.isArray(expected) && !(expected instanceof Date)) {
    const entries = Object.entries(expected).filter(([op]) => op !== "$options");
    return entries.every(([op, value]) => {
      const a = actual;
      if (op === "$in") return value.some((candidate) => compare(a, candidate));
      if (op === "$nin") return !value.some((candidate) => compare(a, candidate));
      if (op === "$exists") return value ? a !== undefined && a !== null : a === undefined || a === null;
      const left = typeof a === "number" && typeof value === "number" ? a : String(a ?? "");
      const right = typeof a === "number" && typeof value === "number" ? value : String(value ?? "");
      if (op === "$gte") return a != null && left >= right;
      if (op === "$lte") return a != null && left <= right;
      if (op === "$gt") return a != null && left > right;
      if (op === "$lt") return a != null && left < right;
      if (op === "$regex") {
        try { return new RegExp(value, expected.$options || "").test(String(a ?? "")); } catch { return false; }
      }
      return false;
    });
  }
  if (Array.isArray(actual)) return actual.includes(expected);
  return actual === expected;
}

function matches(item, query = {}) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === "$or") return expected.some((part) => matches(item, part));
    if (key === "$and") return expected.every((part) => matches(item, part));
    return compare(getPath(item, key), expected);
  });
}

function canRead(entity, user, item) {
  if (publicRead.has(entity)) return true;
  if (!user) return false;
  if (user.role === "admin") return true;
  if (hasStaffAccess(user, "orders") && ownerRead.has(entity)) return true;
  if (ownerRead.has(entity)) return item.created_by_id === user.id;
  if (entity === "AccountDeletionRequest") return item.created_by_id === user.id;
  return false;
}

function canCreate(entity, user, item) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return entity === "AccountDeletionRequest" && item.created_by_id === user.id;
}

function canUpdate(entity, user, item) {
  if (user?.role === "admin") return true;
  return entity === "CartLead" && item.created_by_id === user?.id;
}

function safeRecord(entity, record) {
  if (entity === "User") return safeUser(record);
  if (entity !== "Order") return record;
  const { coupon_token_hash: _hash, ...safe } = record;
  return safe;
}

async function records(entity, service) {
  await ensureDatabase();
  const { rows } = await (service.db ?? getPool()).query("SELECT id, created_at, updated_at, created_by_id, data FROM vps_records WHERE entity=$1", [entity]);
  return rows.map(fields).filter((item) => service.bypass || canRead(entity, service.user, item)).map((item) => safeRecord(entity, item));
}

function queryAccessClause(entity, service, values) {
  if (service.bypass || service.user?.role === "admin" || publicRead.has(entity)) return "";
  if (hasStaffAccess(service.user, "orders") && ownerRead.has(entity)) return "";
  if (ownerRead.has(entity) || entity === "AccountDeletionRequest") {
    if (!service.user?.id) return "FALSE";
    values.push(service.user.id);
    return `created_by_id = $${values.length}`;
  }
  return "FALSE";
}

async function queryRecords(entity, service, query = {}, options = {}) {
  await ensureDatabase();
  const values = [entity];
  const filters = compileEntityQuery(query, values);
  const access = queryAccessClause(entity, service, values);
  const where = ["entity=$1", filters, access].filter(Boolean).join(" AND ");
  const sort = String(options.sort || "-created_date");
  const descending = sort.startsWith("-");
  const sortKey = entityDataExpression(descending ? sort.slice(1) : sort);
  const requestedLimit = Number(options.limit || 100);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 1000)) : 100;
  const parsedOffset = Number.parseInt(options.cursor || options.offset || 0, 10) || 0;
  const offset = Math.min(1_000_000_000, Math.max(0, parsedOffset));
  values.push(limit + 1, offset);
  const { rows } = await (service.db ?? getPool()).query(
    `SELECT id,created_at,updated_at,created_by_id,data FROM vps_records WHERE ${where} ORDER BY ${sortKey} ${descending ? "DESC" : "ASC"} NULLS LAST, id ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => safeRecord(entity, fields(row)));
  return { items, next_cursor: hasMore ? String(offset + limit) : null, has_more: hasMore };
}

async function countRecords(entity, service, query = {}) {
  await ensureDatabase();
  const values = [entity];
  const filters = compileEntityQuery(query, values);
  const access = queryAccessClause(entity, service, values);
  const where = ["entity=$1", filters, access].filter(Boolean).join(" AND ");
  const { rows } = await (service.db ?? getPool()).query(`SELECT COUNT(*)::bigint AS count FROM vps_records WHERE ${where}`, values);
  return Number(rows[0]?.count || 0);
}

function permission(entity, action, user, record) {
  const allowed = action === "read" ? canRead(entity, user, record) : action === "create" ? canCreate(entity, user, record) : canUpdate(entity, user, record);
  if (!allowed) throw Object.assign(new Error("Você não tem permissão para realizar esta operação."), { status: 403 });
}

async function createOne(entity, payload, service) {
  await ensureDatabase();
  const id = payload.id || randomUUID();
  const createdBy = payload.created_by_id || service.user?.id || "";
  const data = { ...jsonCopy(payload), id, created_by_id: createdBy };
  if (!service.bypass) permission(entity, "create", service.user, data);
  if (entity === "User" && !service.bypass) throw Object.assign(new Error("Contas são criadas pelo fluxo de cadastro."), { status: 403 });
  const { rows } = await (service.db ?? getPool()).query(
    "INSERT INTO vps_records(entity,id,created_by_id,data) VALUES($1,$2,$3,$4) RETURNING id,created_at,updated_at,created_by_id,data",
    [entity, id, createdBy, data],
  );
  return safeRecord(entity, fields(rows[0]));
}

async function updateOne(entity, id, patch, service) {
  await ensureDatabase();
  const current = await (service.db ?? getPool()).query("SELECT id,created_at,updated_at,created_by_id,data FROM vps_records WHERE entity=$1 AND id=$2", [entity, id]);
  const row = current.rows[0];
  if (!row) throw Object.assign(new Error("Registro não encontrado."), { status: 404 });
  const before = fields(row);
  if (!service.bypass) permission(entity, "update", service.user, before);
  if (entity === "User" && !service.bypass && id !== service.user?.id) throw Object.assign(new Error("Você não pode editar essa conta."), { status: 403 });
  const nextData = { ...jsonCopy(patch), id, created_by_id: row.created_by_id };
  const { rows } = await (service.db ?? getPool()).query(
    `UPDATE vps_records
     SET data = data || $3::jsonb || CASE
       WHEN entity = 'Order' AND NOT (data ? 'order_alert_at') AND (
         (($3::jsonb->>'payment_status') = 'aprovado' AND data->>'payment_status' IS DISTINCT FROM 'aprovado')
         OR (($3::jsonb->>'checkout_completed') = 'true'
           AND (data->'customer_professional' = 'true'::jsonb OR data->>'payment_status' = 'aprovado'))
       )
       THEN jsonb_build_object('order_alert_at', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
       ELSE '{}'::jsonb
     END, updated_at = now()
     WHERE entity = $1 AND id = $2
     RETURNING id, created_at, updated_at, created_by_id, data`,
    [entity, id, nextData],
  );
  const updated = fields(rows[0]);
  if (entity === "Order" && !row.data.order_alert_at && updated.order_alert_at) {
    const db = service.db ?? getPool();
    const inserted = await db.query(
      `INSERT INTO vps_order_alerts(order_id, created_at)
       VALUES($1, COALESCE(NULLIF($2, '')::timestamptz, now()))
       ON CONFLICT(order_id) DO NOTHING
       RETURNING order_id`,
      [id, updated.order_alert_at],
    );
    if (inserted.rowCount) await db.query("SELECT pg_notify('paracolor_order_alerts', $1)", [id]);
  }
  return safeRecord(entity, updated);
}

async function deleteOne(entity, id, service) {
  await ensureDatabase();
  const current = await (service.db ?? getPool()).query("SELECT id,created_at,updated_at,created_by_id,data FROM vps_records WHERE entity=$1 AND id=$2", [entity, id]);
  if (!current.rowCount) return { deleted: true };
  if (!service.bypass) permission(entity, "update", service.user, fields(current.rows[0]));
  await (service.db ?? getPool()).query("DELETE FROM vps_records WHERE entity=$1 AND id=$2", [entity, id]);
  if (entity === "Order") {
    await (service.db ?? getPool()).query("DELETE FROM vps_order_views WHERE order_id=$1", [id]);
    await (service.db ?? getPool()).query("DELETE FROM vps_order_alerts WHERE order_id=$1", [id]);
  }
  return { deleted: true };
}

function sortRecords(items, sort) {
  if (!sort) return items;
  const desc = sort.startsWith("-");
  const key = desc ? sort.slice(1) : sort;
  return items.sort((a, b) => {
    const av = getPath(a, key); const bv = getPath(b, key);
    if (av == null) return bv == null ? 0 : -1;
    if (bv == null) return 1;
    return (av > bv ? 1 : av < bv ? -1 : 0) * (desc ? -1 : 1);
  });
}

function entityApi(entity, service) {
  const list = async (options = {}) => entityApi(entity, service).filter({}, options);
  const filter = async (query = {}, options = {}) => queryRecords(entity, service, query, options);
  return {
    list,
    filter,
    async get(id) {
      await ensureDatabase();
      const { rows } = await (service.db ?? getPool()).query(
        "SELECT id,created_at,updated_at,created_by_id,data FROM vps_records WHERE entity=$1 AND id=$2 LIMIT 1",
        [entity, id],
      );
      const item = rows[0] ? fields(rows[0]) : null;
      if (!item || (!service.bypass && !canRead(entity, service.user, item))) throw Object.assign(new Error("Registro não encontrado."), { status: 404 });
      return safeRecord(entity, item);
    },
    async count(query = {}) { return countRecords(entity, service, query); },
    async create(data) { return createOne(entity, data, service); },
    async update(id, data) { return updateOne(entity, id, data, service); },
    async delete(id) { return deleteOne(entity, id, service); },
    async bulkCreate(items) { const result = []; for (const item of items) result.push(await createOne(entity, item, service)); return { items: result }; },
    async bulkUpdate(items) { const result = []; for (const item of items) { const { id, ...patch } = item; result.push(await updateOne(entity, id, patch, service)); } return { items: result }; },
    async deleteMany(query = {}) { const found = (await records(entity, service)).filter((item) => matches(item, query)); for (const item of found) await deleteOne(entity, item.id, service); return { deleted: found.length }; },
    async aggregate({ query = {}, groupBy, sum = [] } = {}) {
      const found = (await records(entity, service)).filter((item) => matches(item, query));
      const groups = new Map();
      for (const item of found) {
        const key = groupBy ? String(item[groupBy] ?? "") : "total";
        if (!groups.has(key)) groups.set(key, { ...(groupBy ? { [groupBy]: item[groupBy] } : {}), count: 0 });
        const row = groups.get(key); row.count += 1;
        for (const field of sum) { const keyName = `sum_${field}`; row[keyName] = (row[keyName] || 0) + (Number(item[field]) || 0); }
      }
      return { rows: [...groups.values()] };
    },
    subscribe(listener) { const timer = setInterval(() => listener?.(), 30_000); return () => clearInterval(timer); },
  };
}

export function makeEntityService(user, bypass = false, db) {
  const service = { user, bypass, db };
  const entities = new Proxy({}, { get: (_target, entity) => entityApi(String(entity), service) });
  return { entities, user, bypass };
}


export async function entityRequest(request, user) {
  const body = request.method === "GET" ? Object.fromEntries(new URL(request.url).searchParams) : await request.json();
  const entity = String(body.entity || "");
  if (["PaymentAttempt", "PaymentProviderConfig", "AdminSecondFactor", "IntegrationConfig", "OrderNotice", "FileDeletionJob"].includes(entity)) {
    throw Object.assign(new Error("Entidade privada."), { status: 403 });
  }
  if (!/^[A-Za-z][A-Za-z0-9]{0,60}$/.test(entity)) throw Object.assign(new Error("Entidade inválida."), { status: 400 });
  if (entity === "Order" && !["list", "filter", "get", "count", "aggregate"].includes(body.action)) {
    const allowed = new Set(["internal_number", "last_action_by", "last_action_email", "last_action_at", "tracking_code", "tracking_url"]);
    if (body.action !== "update" || Object.keys(body.data ?? {}).some((key) => !allowed.has(key))) {
      throw Object.assign(new Error("Altere o pedido pelo fluxo de operação."), { status: 403 });
    }
  }
  const service = makeEntityService(user);
  const api = entityApi(entity, service);
  const payload = body.data ?? {};
  switch (body.action) {
    case "list": return api.list(body.options || {});
    case "filter": return api.filter(body.query || {}, body.options || {});
    case "get": return api.get(body.id);
    case "count": return api.count(body.query || {});
    case "aggregate": return api.aggregate(payload);
    case "create": return api.create(payload);
    case "update": return api.update(body.id, payload);
    case "delete": return api.delete(body.id);
    case "bulkCreate": return api.bulkCreate(payload.items || []);
    case "bulkUpdate": return api.bulkUpdate(payload.items || []);
    case "deleteMany": return api.deleteMany(body.query || {});
    default: throw Object.assign(new Error("Operação desconhecida."), { status: 400 });
  }
}

export { resultArray };
