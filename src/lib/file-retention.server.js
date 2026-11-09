import { createHash } from "node:crypto";
import path from "node:path";
import { rm } from "node:fs/promises";
import { ensureDatabase, getPool, withTransaction } from "./vps/db.server.js";

const safeId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const lockRetention = (db) => db.query("SELECT pg_advisory_xact_lock(hashtextextended('paracolor-file-retention',0))");

async function enqueueOriginals(db, uris) {
  const ids = [...new Set(uris.map((uri) => String(uri).replace(/^vps:/, "")).filter((id) => safeId.test(id)))];
  if (!ids.length) return;
  await db.query(
    `INSERT INTO vps_records(entity,id,data) SELECT 'FileDeletionJob',id,'{}'::jsonb
     FROM vps_files WHERE visibility='private' AND id=ANY($1::text[]) ON CONFLICT DO NOTHING`, [ids],
  );
}

async function removeUnreferencedFiles(limit) {
  const totals = { files: 0, bytes: 0 };
  const { rows } = await getPool().query(
    "SELECT id FROM vps_records WHERE entity='FileDeletionJob' ORDER BY created_at LIMIT $1", [limit],
  );
  for (const { id } of rows) {
    if (!safeId.test(id)) continue;
    try {
      const bytes = await withTransaction(async (db) => {
        await lockRetention(db);
        const { rows: [file] } = await db.query("SELECT byte_size FROM vps_files WHERE visibility='private' AND id=$1 FOR UPDATE", [id]);
        const { rowCount } = await db.query(
          `SELECT 1 FROM vps_records WHERE entity <> 'FileDeletionJob' AND strpos(data::text, $1) > 0 LIMIT 1`, [id],
        );
        if (file && !rowCount) {
          await rm(path.resolve(process.env.STORAGE_DIR || "./data/uploads", "private", id), { force: true });
          await db.query("DELETE FROM vps_files WHERE id=$1", [id]);
        }
        await db.query("DELETE FROM vps_records WHERE entity='FileDeletionJob' AND id=$1", [id]);
        return file && !rowCount ? Number(file.byte_size) : 0;
      });
      if (bytes) {
        totals.files++;
        totals.bytes += bytes;
      }
    } catch (error) {
      console.error("Falha na exclusão de arquivo em retenção:", error.code || "erro de armazenamento");
      await getPool().query("UPDATE vps_records SET created_at=now() WHERE entity='FileDeletionJob' AND id=$1", [id]);
    }
  }
  return totals;
}

const RETENTION_BATCH = 500;

const cutoffFor = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
const batchSignature = (rows) => createHash("sha256")
  .update(JSON.stringify([rows[0]?.total ?? 0, ...rows.map(({ id, uri }) => [id, uri])])).digest("hex");

async function retentionSettings(db, lock = false) {
  const { rows: [settings] } = await db.query(
    `SELECT data FROM vps_records WHERE entity='Settings' ORDER BY created_at DESC, id DESC LIMIT 1 ${lock ? "FOR SHARE" : ""}`,
  );
  return {
    days: Math.max(1, Math.min(3650, Math.trunc(Number(settings?.data?.retention_days) || 90))),
    automatic: settings?.data?.retention_auto !== false,
  };
}

async function eligibleOriginals(db, cutoff) {
  const { rows } = await db.query(
    `SELECT p.id,p.data->>'original_file_uri' AS uri,o.id AS order_id, count(*) OVER ()::int AS total
     FROM vps_records p JOIN vps_records o ON o.entity='Order' AND o.id=p.data->>'order_id'
     WHERE p.entity='OrderPhoto' AND nullif(p.data->>'original_file_uri','') IS NOT NULL
       AND o.data->>'status' IN ('enviado','retirado','concluido')
       AND COALESCE(
         (SELECT max(event->>'date') FROM jsonb_array_elements(
           CASE WHEN jsonb_typeof(o.data->'status_history')='array' THEN o.data->'status_history' ELSE '[]'::jsonb END
         ) event WHERE event->>'status'=o.data->>'status' AND event->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'),
         to_char(o.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       ) < $1
     ORDER BY p.id LIMIT ${RETENTION_BATCH}`,
    [cutoff],
  );
  return rows;
}

export async function previewOriginalRetention() {
  await ensureDatabase();
  const db = getPool();
  const { days } = await retentionSettings(db);
  const cutoff = cutoffFor(days);
  const rows = await eligibleOriginals(db, cutoff);
  return { days, cutoff, signature: batchSignature(rows), count: rows.length, total: rows[0]?.total ?? 0 };
}

async function runOriginalRetention({ scheduled = false, preview } = {}) {
  const result = await withTransaction(async (db) => {
    await lockRetention(db);
    const { days, automatic } = await retentionSettings(db, true);
    if (scheduled && !automatic) return null;
    if (scheduled) {
      const { rows: [entry] } = await db.query(
        `SELECT data FROM vps_records WHERE entity='RetentionRun' AND id='latest'
         AND updated_at > now() - interval '1 day'`,
      );
      if (entry?.data?.complete) return null;
    }
    const cutoff = preview?.cutoff ?? cutoffFor(days);
    if (preview && (days !== preview.days || cutoff > cutoffFor(days))) {
      throw new Error("O prazo salvo mudou. Consulte novamente os originais antes de apagar.");
    }
    const rows = await eligibleOriginals(db, cutoff);
    if (preview && (preview.signature !== batchSignature(rows) || !rows.length)) {
      throw new Error("A lista de originais mudou. Consulte novamente antes de apagar.");
    }
    if (rows.length) {
      const { rowCount } = await db.query(
        `UPDATE vps_records p SET data=p.data || '{"original_file_uri":""}'::jsonb, updated_at=now()
         FROM unnest($1::text[], $2::text[]) AS expected(id, uri)
         WHERE p.entity='OrderPhoto' AND p.id=expected.id AND p.data->>'original_file_uri'=expected.uri`,
        [rows.map(({ id }) => id), rows.map(({ uri }) => uri)],
      );
      if (rowCount !== rows.length) throw new Error("A lista de originais mudou. Consulte novamente antes de apagar.");
      await enqueueOriginals(db, rows.map(({ uri }) => uri));
    }
    return { purged: rows.length, orders: new Set(rows.map(({ order_id }) => order_id)).size, complete: rows.length === (rows[0]?.total ?? 0) };
  });
  const files = await removeUnreferencedFiles(500);
  if (!result) return { purged: 0, orders: 0, ...files };
  const status = { ...result, ...files, at: new Date().toISOString() };
  await getPool().query(
    `INSERT INTO vps_records(entity,id,data) VALUES('RetentionRun','latest',$1)
     ON CONFLICT(entity,id) DO UPDATE SET data=excluded.data,updated_at=now()`, [status],
  );
  return status;
}

export function applyOriginalRetention(preview) {
  return runOriginalRetention({ preview });
}

export function scheduleFileRetention() {
  return runOriginalRetention({ scheduled: true });
}

export async function photosByPeriod(from, to, expectedCount = 0) {
  const conditions = `p.entity='OrderPhoto' AND p.created_at BETWEEN $1 AND $2
    AND EXISTS (SELECT 1 FROM vps_records o WHERE o.entity='Order' AND o.id=p.data->>'order_id'
      AND o.data->>'status' IN ('retirado','concluido','cancelado'))`;
  if (!expectedCount) {
    await ensureDatabase();
    const { rows: [summary] } = await getPool().query(
      `SELECT count(*)::int AS count, count(DISTINCT p.data->>'order_id')::int AS orders FROM vps_records p WHERE ${conditions}`, [from, to],
    );
    return summary;
  }
  const deleted = await withTransaction(async (db) => {
    await lockRetention(db);
    const { rows } = await db.query(
      `DELETE FROM vps_records p WHERE ${conditions} RETURNING p.data->>'original_file_uri' AS original,p.data->>'print_file_uri' AS print`, [from, to],
    );
    if (rows.length !== expectedCount) throw new Error("As fotos do período mudaram. Consulte o período novamente.");
    await enqueueOriginals(db, rows.flatMap(({ original, print }) => [original, print]));
    return rows.length;
  });
  return { deleted, ...(await removeUnreferencedFiles(500)) };
}
