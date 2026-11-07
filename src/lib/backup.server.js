import { createReadStream, createWriteStream } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createGzip, createGunzip } from "node:zlib";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { getPool, ensureDatabase } from "@/lib/vps/db.server";

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "data", "uploads");
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "data", "backups");
const MAX_BACKUP_BYTES = Number(process.env.MAX_BACKUP_MB || 10240) * 1024 * 1024;
let restoreRunning = false;
let automaticBackupRunning = false;
let backupSchedulerStarted = false;

const TABLES = {
  vps_records: { order: "entity,id", columns: ["entity", "id", "created_at", "updated_at", "created_by_id", "data"], json: ["data"] },
  vps_otps: { order: "email,purpose", columns: ["email", "purpose", "code_hash", "payload", "expires_at", "attempts"], json: ["payload"] },
  vps_files: { order: "id", columns: ["id", "owner_id", "visibility", "original_name", "mime_type", "byte_size", "created_at"], json: [] },
  vps_rate_limits: { order: "key", columns: ["key", "window_started_at", "hits"], json: [] },
};

const RUNTIME_CONFIG_KEYS = [
  "APP_VERSION", "APP_DOMAIN", "PUBLIC_APP_URL", "DATABASE_URL", "SESSION_SECRET", "SESSION_COOKIE_SECURE", "DATABASE_SSL", "DB_POOL_SIZE",
  "STORAGE_DIR", "BACKUP_DIR", "MAX_UPLOAD_MB", "MAX_BACKUP_MB", "BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_PASSWORD", "BOOTSTRAP_ADMIN_NAME",
  "MERCADO_PAGO_ACCESS_TOKEN", "MERCADO_PAGO_WEBHOOK_SECRET", "MELHOR_ENVIO_TOKEN", "MELHOR_ENVIO_CONTACT_EMAIL",
  "MELHOR_ENVIO_PACKAGE_WIDTH", "MELHOR_ENVIO_PACKAGE_HEIGHT", "MELHOR_ENVIO_PACKAGE_LENGTH", "MELHOR_ENVIO_PACKAGE_WEIGHT", "GITHUB_REPOSITORY", "GITHUB_TOKEN",
  "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_FROM_NAME",
];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let stderr = "";
    child.stderr?.on("data", (part) => { stderr = `${stderr}${part}`.slice(-5000); });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `${path.basename(command)} terminou com código ${code}.`)));
  });
}

function isSafeArchivePath(value) {
  const name = String(value).replace(/\\/g, "/");
  return !name.startsWith("/") && !/^[a-zA-Z]:/.test(name) && !name.split("/").includes("..");
}

async function validateTar(filePath, expectedTopLevel) {
  const child = spawn("tar", ["-tzf", filePath], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
  const exited = once(child, "exit");
  const reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
  let count = 0;
  try {
    for await (const entry of reader) {
      count += 1;
      if (count > 1_000_000 || !isSafeArchivePath(entry)) throw new Error("O backup contém caminhos inválidos.");
      if (expectedTopLevel && !expectedTopLevel.has(entry.replace(/\/$/, ""))) throw new Error("O arquivo não tem o formato de backup Paracolor esperado.");
    }
    const [code] = await exited;
    if (code !== 0) throw new Error("Não foi possível validar o arquivo de backup.");
    if (!count) throw new Error("O backup está vazio.");
  } catch (error) {
    child.kill();
    throw error;
  }
}

async function writeDatabaseSnapshot(destination) {
  await ensureDatabase();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const source = Readable.from((async function* () {
      for (const [table, definition] of Object.entries(TABLES)) {
        let offset = 0;
        while (true) {
          const { rows } = await client.query(`SELECT * FROM ${table} ORDER BY ${definition.order} LIMIT 500 OFFSET $1`, [offset]);
          if (!rows.length) break;
          for (const row of rows) yield `${JSON.stringify({ table, row })}\n`;
          offset += rows.length;
        }
      }
    })());
    await pipeline(source, createGzip({ level: 6 }), createWriteStream(destination, { mode: 0o600 }));
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function makeBackupBundle(destination) {
  await mkdir(BACKUP_DIR, { recursive: true });
  const workDir = await mkdtemp(path.join(BACKUP_DIR, ".bundle-"));
  try {
    const manifest = {
      format: "paracolor-full-backup",
      format_version: 1,
      created_at: new Date().toISOString(),
      app_version: process.env.APP_VERSION || "1.0.5",
      includes: ["postgresql application data", "uploaded files", "runtime configuration snapshot"],
    };
    await writeFile(path.join(workDir, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    await writeDatabaseSnapshot(path.join(workDir, "database.ndjson.gz"));
    await mkdir(STORAGE_DIR, { recursive: true });
    await run("tar", ["-czf", path.join(workDir, "uploads.tar.gz"), "-C", STORAGE_DIR, "."]);
    const runtimeConfig = Object.fromEntries(RUNTIME_CONFIG_KEYS.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
    await writeFile(path.join(workDir, "runtime-config.json"), JSON.stringify(runtimeConfig, null, 2), { mode: 0o600 });
    await run("tar", ["-czf", destination, "-C", workDir, "manifest.json", "database.ndjson.gz", "uploads.tar.gz", "runtime-config.json"]);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractBackup(archivePath, destination) {
  const expected = new Set(["manifest.json", "database.ndjson.gz", "uploads.tar.gz", "runtime-config.json"]);
  await validateTar(archivePath, expected);
  await mkdir(destination, { recursive: true });
  await run("tar", ["-xzf", archivePath, "-C", destination, "--no-same-owner", "--no-same-permissions"]);
  const manifest = JSON.parse(await readFile(path.join(destination, "manifest.json"), "utf8"));
  if (manifest.format !== "paracolor-full-backup" || manifest.format_version !== 1) throw new Error("Formato ou versão de backup não reconhecido.");
  await validateTar(path.join(destination, "uploads.tar.gz"));
  return manifest;
}

async function replaceUploadsFromArchive(archivePath, stagingDir) {
  const incomingDir = path.join(stagingDir, "uploads");
  await mkdir(incomingDir, { recursive: true });
  await run("tar", ["-xzf", archivePath, "-C", incomingDir, "--no-same-owner", "--no-same-permissions"]);
  await mkdir(STORAGE_DIR, { recursive: true });
  for (const entry of await readdir(STORAGE_DIR)) {
    await rm(path.join(STORAGE_DIR, entry), { recursive: true, force: true });
  }
  for (const entry of await readdir(incomingDir)) {
    await cp(path.join(incomingDir, entry), path.join(STORAGE_DIR, entry), { recursive: true, force: true, dereference: false });
  }
}

async function insertRows(client, table, rows) {
  if (!rows.length) return;
  const definition = TABLES[table];
  const columns = definition.columns;
  const values = [];
  const tuples = rows.map((row) => {
    const offset = values.length;
    for (const column of columns) values.push(definition.json.includes(column) ? JSON.stringify(row[column] ?? {}) : row[column] ?? null);
    return `(${columns.map((column, index) => `$${offset + index + 1}${definition.json.includes(column) ? "::jsonb" : ""}`).join(",")})`;
  });
  await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${tuples.join(",")}`, values);
}

async function restoreDatabaseSnapshot(filePath) {
  await ensureDatabase();
  const client = await getPool().connect();
  const batches = Object.fromEntries(Object.keys(TABLES).map((table) => [table, []]));
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE vps_records, vps_otps, vps_files, vps_rate_limits RESTART IDENTITY");
    const input = createReadStream(filePath).pipe(createGunzip());
    const lines = createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line) continue;
      const item = JSON.parse(line);
      if (!TABLES[item.table] || !item.row || typeof item.row !== "object") throw new Error("O backup do banco contém uma linha inválida.");
      batches[item.table].push(item.row);
      if (batches[item.table].length >= 250) {
        await insertRows(client, item.table, batches[item.table]);
        batches[item.table] = [];
      }
    }
    for (const [table, rows] of Object.entries(batches)) await insertRows(client, table, rows);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function backupDirectory() {
  return BACKUP_DIR;
}

export async function createDownloadBackup() {
  await mkdir(BACKUP_DIR, { recursive: true });
  const workDir = await mkdtemp(path.join(BACKUP_DIR, ".export-"));
  const archivePath = path.join(workDir, `Paracolor-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.tar.gz`);
  try {
    await makeBackupBundle(archivePath);
    return { archivePath, workDir };
  } catch (error) {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export async function listRestoreBackups() {
  await mkdir(BACKUP_DIR, { recursive: true });
  const files = await readdir(BACKUP_DIR);
  const all = await Promise.all(files.filter((name) => /^(pre-restore|auto)-[\w-]+\.tar\.gz$/.test(name)).map(async (name) => {
    const details = await stat(path.join(BACKUP_DIR, name));
    return { name, size: details.size, created_at: details.mtime.toISOString(), type: name.startsWith("auto-") ? "automatic" : "before_restore" };
  }));
  const byNewest = (items) => items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { automatic: byNewest(all.filter((item) => item.type === "automatic")), before_restore: byNewest(all.filter((item) => item.type === "before_restore")) };
}

export async function restoreBackupFromUpload(archivePath, restoreConfirmation) {
  if (restoreRunning) throw new Error("Já existe uma restauração em andamento.");
  if (restoreConfirmation !== "RESTAURAR") throw new Error("Digite RESTAURAR para confirmar a substituição dos dados.");
  restoreRunning = true;
  let stagingDir;
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    stagingDir = await mkdtemp(path.join(BACKUP_DIR, ".restore-"));
    const safetyArchive = path.join(BACKUP_DIR, `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.tar.gz`);
    await mkdir(BACKUP_DIR, { recursive: true });
    const uploadedDir = path.join(stagingDir, "uploaded");
    const manifest = await extractBackup(archivePath, uploadedDir);
    await makeBackupBundle(safetyArchive);
    const safetyDir = path.join(stagingDir, "safety");
    await extractBackup(safetyArchive, safetyDir);
    try {
      await replaceUploadsFromArchive(path.join(uploadedDir, "uploads.tar.gz"), path.join(stagingDir, "incoming"));
      await restoreDatabaseSnapshot(path.join(uploadedDir, "database.ndjson.gz"));
    } catch (error) {
      await replaceUploadsFromArchive(path.join(safetyDir, "uploads.tar.gz"), path.join(stagingDir, "rollback"));
      throw new Error(`O banco não foi restaurado e os arquivos atuais foram recuperados. ${error.message}`);
    }
    await writeFile(path.join(BACKUP_DIR, "last-restored-version"), String(manifest.app_version || "unknown"), "utf8");
    const backups = await listRestoreBackups();
    for (const item of backups.before_restore.slice(3)) await rm(path.join(BACKUP_DIR, item.name), { force: true });
    return { ok: true, created_at: manifest.created_at, app_version: manifest.app_version };
  } finally {
    if (stagingDir) await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    restoreRunning = false;
  }
}

export async function receiveBackupUpload(request, destination) {
  const output = createWriteStream(destination, { mode: 0o600, flags: "wx" });
  let received = 0;
  const limiter = new Transform({ transform(chunk, _encoding, callback) {
    received += chunk.length;
    if (received > MAX_BACKUP_BYTES) return callback(new Error("O backup excede o limite configurado para upload."));
    callback(null, chunk);
  } });
  if (!request.body) throw new Error("O arquivo de backup está vazio.");
  await pipeline(Readable.fromWeb(request.body), limiter, output);
  if (!received) throw new Error("O arquivo de backup está vazio.");
  return received;
}

export async function downloadStoredBackup(name) {
  if (!/^(pre-restore|auto)-[\w-]+\.tar\.gz$/.test(name)) return null;
  const filePath = path.join(BACKUP_DIR, name);
  try { await stat(filePath); return filePath; }
  catch { return null; }
}

function saoPauloClock(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

async function runScheduledBackup() {
  if (automaticBackupRunning || restoreRunning) return;
  automaticBackupRunning = true;
  let destination = "";
  try {
    await ensureDatabase();
    const { rows } = await getPool().query("SELECT data FROM vps_records WHERE entity='Settings' ORDER BY created_at DESC LIMIT 1");
    const settings = rows[0]?.data ?? {};
    if (settings.auto_backup_enabled === false) return;
    const scheduledTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.auto_backup_time) ? settings.auto_backup_time : "03:00";
    const clock = saoPauloClock();
    if (clock.time < scheduledTime) return;
    await mkdir(BACKUP_DIR, { recursive: true });
    destination = path.join(BACKUP_DIR, `auto-${clock.date}.tar.gz`);
    try { await stat(destination); return; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    await makeBackupBundle(destination);
    const retention = Math.max(1, Math.min(60, Number(settings.auto_backup_retention) || 7));
    const backups = await listRestoreBackups();
    for (const old of backups.automatic.slice(retention)) await rm(path.join(BACKUP_DIR, old.name), { force: true });
  } catch (error) {
    if (destination) await rm(destination, { force: true }).catch(() => {});
    console.error("Falha ao criar o backup automático diário:", error);
  } finally {
    automaticBackupRunning = false;
  }
}

export function startBackupScheduler() {
  if (backupSchedulerStarted) return;
  backupSchedulerStarted = true;
  const timer = setInterval(() => { void runScheduledBackup(); }, 60_000);
  timer.unref?.();
}

export async function setBackupDownloadHeaders(filePath, storedName) {
  const details = await stat(filePath);
  return {
    "content-type": "application/gzip",
    "content-length": String(details.size),
    "content-disposition": `attachment; filename="${storedName.replace(/["\r\n]/g, "")}"`,
    "cache-control": "no-store, private",
    "x-content-type-options": "nosniff",
  };
}
