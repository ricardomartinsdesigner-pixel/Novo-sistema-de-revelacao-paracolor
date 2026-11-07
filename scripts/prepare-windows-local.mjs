import { randomBytes } from "node:crypto";
import { log } from "node:console";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { URL } from "node:url";
import pg from "pg";

const { Client } = pg;
const envFile = path.resolve(".env.windows-local");

async function connect(options) {
  const client = new Client({ connectionTimeoutMillis: 5000, ...options });
  await client.connect();
  return client;
}

if (process.env.DATABASE_URL) {
  const client = await connect({ connectionString: process.env.DATABASE_URL });
  try { await client.query("SELECT 1"); }
  finally { await client.end(); }
  log("Conexao local com PostgreSQL verificada.");
} else {
  const password = process.env.PG_ADMIN_PASSWORD;
  if (!password) throw new Error("Senha do PostgreSQL nao informada.");

  const admin = await connect({
    host: "127.0.0.1",
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
  });

  const appPassword = randomBytes(32).toString("base64url");
  const sqlPassword = `'${appPassword.replaceAll("'", "''")}'`;
  try {
    await admin.query(`CREATE ROLE paracolor LOGIN PASSWORD ${sqlPassword}`);
  } catch (error) {
    if (error.code !== "42710") throw error;
    await admin.query(`ALTER ROLE paracolor WITH LOGIN PASSWORD ${sqlPassword}`);
  }

  try {
    const { rows } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", ["paracolor"]);
    if (!rows.length) await admin.query("CREATE DATABASE paracolor OWNER paracolor");
    else await admin.query("ALTER DATABASE paracolor OWNER TO paracolor");
  } finally {
    await admin.end();
  }

  const databaseUrl = new URL("postgresql://paracolor@127.0.0.1:5432/paracolor");
  databaseUrl.password = appPassword;
  const storageDir = path.resolve("data", "uploads").replaceAll("\\", "/");
  const sessionSecret = randomBytes(32).toString("hex");
  const configuration = [
    "NODE_ENV=production",
    "PORT=3000",
    "NITRO_HOST=127.0.0.1",
    "PUBLIC_APP_URL=http://localhost:3000",
    `DATABASE_URL=${databaseUrl.toString()}`,
    `SESSION_SECRET=${sessionSecret}`,
    "SESSION_COOKIE_SECURE=false",
    `STORAGE_DIR="${storageDir}"`,
    "BOOTSTRAP_ADMIN_EMAIL=admin@localhost",
    'BOOTSTRAP_ADMIN_PASSWORD="ParacolorLocal#2026"',
    'BOOTSTRAP_ADMIN_NAME="Administrador de Teste"',
    "MAX_UPLOAD_MB=80",
    "MERCADO_PAGO_ACCESS_TOKEN=",
    "MELHOR_ENVIO_TOKEN=",
    "",
  ].join("\n");

  await writeFile(envFile, configuration, { encoding: "utf8", flag: "wx" });
  log("Banco paracolor preparado e configuracao local criada.");
}
