import pg from "pg";

const { Pool } = pg;
let pool;
let initialized;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não foi configurada.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_SIZE || 10),
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    });
    pool.on("error", (error) => console.error("Erro inesperado no pool PostgreSQL:", error));
  }
  return pool;
}

export async function ensureDatabase() {
  if (!initialized) {
    initialized = (async () => {
      const db = getPool();
      await db.query(`
        CREATE TABLE IF NOT EXISTS vps_records (
          entity text NOT NULL,
          id text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          created_by_id text NOT NULL DEFAULT '',
          data jsonb NOT NULL DEFAULT '{}'::jsonb,
          PRIMARY KEY (entity, id)
        );
        CREATE INDEX IF NOT EXISTS vps_records_entity_created_idx ON vps_records(entity, created_at DESC);
        CREATE INDEX IF NOT EXISTS vps_records_owner_idx ON vps_records(entity, created_by_id);
        CREATE INDEX IF NOT EXISTS vps_order_photo_order_idx ON vps_records ((data->>'order_id')) WHERE entity='OrderPhoto';
        CREATE INDEX IF NOT EXISTS vps_order_coupon_idx ON vps_records ((data->>'coupon_id')) WHERE entity='Order';
        CREATE INDEX IF NOT EXISTS vps_order_legacy_coupon_idx ON vps_records (UPPER(TRIM(data->>'coupon_code')))
          WHERE entity='Order' AND NOT (data ? 'coupon_id');
        CREATE INDEX IF NOT EXISTS vps_order_alert_at_idx ON vps_records ((data->>'order_alert_at'))
          WHERE entity = 'Order' AND data ? 'order_alert_at';
        CREATE TABLE IF NOT EXISTS vps_order_alerts (
          order_id text PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          is_legacy boolean NOT NULL DEFAULT false
        );
        ALTER TABLE vps_order_alerts ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false;
        CREATE INDEX IF NOT EXISTS vps_order_alerts_created_idx ON vps_order_alerts(created_at DESC);
        CREATE TABLE IF NOT EXISTS vps_order_views (
          order_id text NOT NULL,
          user_id text NOT NULL,
          user_name text NOT NULL DEFAULT '',
          viewed_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (order_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS vps_order_views_order_idx ON vps_order_views(order_id, viewed_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS vps_user_email_unique_idx ON vps_records(lower(data->>'email')) WHERE entity='User';
        CREATE TABLE IF NOT EXISTS vps_otps (
          email text NOT NULL,
          purpose text NOT NULL,
          code_hash text NOT NULL,
          payload jsonb NOT NULL DEFAULT '{}'::jsonb,
          expires_at timestamptz NOT NULL,
          attempts integer NOT NULL DEFAULT 0,
          PRIMARY KEY(email, purpose)
        );
        CREATE TABLE IF NOT EXISTS vps_files (
          id text PRIMARY KEY,
          owner_id text NOT NULL DEFAULT '',
          visibility text NOT NULL CHECK (visibility IN ('private', 'public')),
          original_name text NOT NULL,
          mime_type text NOT NULL,
          byte_size bigint NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS vps_rate_limits (
          key text PRIMARY KEY,
          window_started_at timestamptz NOT NULL DEFAULT now(),
          hits integer NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS vps_site_visitor_daily (
          visitor_id text NOT NULL,
          visit_day date NOT NULL,
          pageviews integer NOT NULL DEFAULT 0,
          last_pageview_at timestamptz,
          PRIMARY KEY(visitor_id, visit_day)
        );
        CREATE INDEX IF NOT EXISTS vps_site_visitor_day_idx ON vps_site_visitor_daily(visit_day DESC);
        CREATE TABLE IF NOT EXISTS vps_site_presence (
          visitor_id text PRIMARY KEY,
          last_seen_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS vps_site_presence_seen_idx ON vps_site_presence(last_seen_at DESC);
      `);
      await db.query(
        `INSERT INTO vps_order_alerts(order_id, created_at, is_legacy)
         SELECT id, COALESCE(NULLIF(data->>'order_alert_at', '')::timestamptz, created_at), true
         FROM vps_records WHERE entity='Order' AND data ? 'order_alert_at'
           AND data->>'status'=ANY(ARRAY['pagamento_aprovado','aguardando_arte','aguardando_aprovacao',
             'ajustes_solicitados','arte_aprovada','aguardando_producao']::text[])
         ON CONFLICT(order_id) DO NOTHING`,
      );
      await db.query("DELETE FROM vps_rate_limits WHERE window_started_at < now()-interval '2 days'");
      await seedAdmin(db);
      // Corrige vínculos marcados como bloqueados antes da revogação atômica.
      await db.query(`
        UPDATE vps_records u SET data=jsonb_set(u.data, '{role}', '"user"'), updated_at=now()
        WHERE u.entity='User' AND u.data->>'role'='admin' AND EXISTS (
          SELECT 1 FROM vps_records e WHERE e.entity='Employee' AND e.data->'active'='false'::jsonb AND (
            e.data->>'user_id'=u.id OR (
              nullif(e.data->>'user_id','') IS NULL AND lower(e.data->>'email')=lower(u.data->>'email')
            )
          )
        )
      `);
    })().catch((error) => {
      initialized = undefined;
      throw error;
    });
  }
  return initialized;
}

function hashPassword(password, salt) {
  const { scryptSync } = awaitCrypto;
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

// This module is server-only and is imported only from the VPS backend.
import { scryptSync, randomBytes, randomUUID } from "node:crypto";
const awaitCrypto = { scryptSync };

async function seedAdmin(db) {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
  if (!email || !password) return;
  if (password.length < 12) throw new Error("BOOTSTRAP_ADMIN_PASSWORD precisa ter pelo menos 12 caracteres.");
  const found = await db.query("SELECT id FROM vps_records WHERE entity='User' AND lower(data->>'email')=$1 LIMIT 1", [email]);
  if (found.rowCount) return;
  const id = randomUUID();
  const salt = randomBytes(16).toString("hex");
  const data = {
    id,
    email,
    full_name: process.env.BOOTSTRAP_ADMIN_NAME || "Administrador Paracolor",
    role: "admin",
    is_verified: true,
    password_hash: hashPassword(password, salt),
  };
  await db.query("INSERT INTO vps_records(entity,id,created_by_id,data) VALUES('User',$1,$1,$2) ON CONFLICT DO NOTHING", [id, data]);
}

export function safeUser(user) {
  if (!user) return null;
  const { password_hash, reset_token, ...safe } = user;
  return safe;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, expected] = stored.split(":");
  const actual = scryptSync(password, salt, 64).toString("hex");
  return actual.length === expected.length && Buffer.from(actual).equals(Buffer.from(expected));
}

export function newPasswordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return hashPassword(password, salt);
}

export { randomBytes, randomUUID };

export async function withTransaction(run) {
  await ensureDatabase();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
