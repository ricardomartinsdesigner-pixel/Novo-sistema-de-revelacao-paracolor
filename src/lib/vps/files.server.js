import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDatabase, getPool, randomUUID } from "./db.server";
import { hasStaffAccess } from "../staff-access";

const storageRoot = () => path.resolve(process.env.STORAGE_DIR || "./data/uploads");
const secret = () => {
  if ((process.env.SESSION_SECRET || "").length < 32) throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres.");
  return process.env.SESSION_SECRET;
};
const signature = (id, expires, viewer) => createHmac("sha256", secret()).update(`private-file-v2:${id}:${expires}:${viewer}`).digest("base64url");
const filePath = (visibility, id) => path.join(storageRoot(), visibility, id);

const storedId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const idFor = (uri) => String(uri).replace(/^vps:/, "");

async function ownedPrivateFiles(uris, ownerId, db, lock = false) {
  if (!uris.length) return [];
  const ids = [...new Set(uris.map(idFor))];
  const denied = () => Object.assign(new Error("Um arquivo está indisponível para este pedido. Envie-o novamente pela sua conta."), { status: 403 });
  if (!ownerId || ids.some((id) => !storedId.test(id))) throw denied();
  const { rows } = await db.query(
    `SELECT id, visibility, original_name FROM vps_files
     WHERE owner_id=$1 AND visibility='private' AND id=ANY($2::text[])` + (lock ? " FOR KEY SHARE" : ""),
    [ownerId, ids],
  );
  if (rows.length !== ids.length) throw denied();
  return rows;
}

export async function validateOrderUploads(uris, ownerId, db) {
  // Bloqueia a remoção do cadastro do arquivo até que o pedido esteja gravado.
  await ownedPrivateFiles(uris, ownerId, db, true);
}

export async function orderArchiveFiles(uris, ownerId) {
  await ensureDatabase();
  const rows = await ownedPrivateFiles(uris, ownerId, getPool());
  const files = await Promise.all(rows.map(async (row) => {
    const filename = filePath(row.visibility, row.id);
    if (!(await stat(filename)).isFile()) throw new Error("Arquivo não encontrado.");
    return [row.id, { filename, extension: path.extname(row.original_name).slice(1).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) }];
  }));
  const byId = new Map(files);
  return new Map(uris.map((uri) => [uri, byId.get(idFor(uri))]));
}

function verifyContentType(mime, bytes) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (mime === "image/avif") return bytes.toString("ascii", 4, 8) === "ftyp" && ["avif", "avis"].includes(bytes.toString("ascii", 8, 12));
  if (mime === "application/pdf") return bytes.toString("ascii", 0, 5) === "%PDF-";
  if (mime === "video/mp4") return bytes.toString("ascii", 4, 8) === "ftyp";
  if (mime === "video/webm") return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return false;
}

async function isStaffOrderFile(id, user) {
  if (!hasStaffAccess(user, "orders")) return false;
  const uri = `vps:${id}`;
  const { rows } = await getPool().query(
    `SELECT entity FROM vps_records WHERE
       (entity='OrderPhoto' AND $1::text = ANY(ARRAY[data->>'original_file_uri', data->>'print_file_uri']))
       OR (entity='Order' AND data->>'art_file_uri'=$1)
     LIMIT 1`, [uri],
  );
  if (!rows.length) return false;
  return rows[0].entity === "OrderPhoto"
    ? hasStaffAccess(user, "production")
    : hasStaffAccess(user, "art");
}

export async function saveUploadedFile(file, user, visibility = "private") {
  await ensureDatabase();
  if (!file || typeof file.arrayBuffer !== "function") throw Object.assign(new Error("Arquivo não recebido."), { status: 400 });
  const max = Math.max(1, Number(process.env.MAX_UPLOAD_MB || 80)) * 1024 * 1024;
  if (file.size <= 0 || file.size > max) throw Object.assign(new Error(`O arquivo precisa ter até ${Math.round(max / 1024 / 1024)} MB.`), { status: 413 });
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf", "video/mp4", "video/webm"]);
  const mime = String(file.type || "application/octet-stream").toLowerCase();
  if (!allowed.has(mime)) throw Object.assign(new Error("Formato de arquivo não permitido."), { status: 415 });
  if (visibility === "public" && user?.role !== "admin") throw Object.assign(new Error("Apenas administradores podem publicar arquivos."), { status: 403 });
  const id = randomUUID();
  const dir = path.dirname(filePath(visibility, id));
  await mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!verifyContentType(mime, bytes)) throw Object.assign(new Error("O conteúdo do arquivo não corresponde ao formato informado."), { status: 415 });
  await writeFile(filePath(visibility, id), bytes, { flag: "wx" });
  const originalName = path.basename(String(file.name || "arquivo")).slice(0, 240);
  await getPool().query("INSERT INTO vps_files(id,owner_id,visibility,original_name,mime_type,byte_size) VALUES($1,$2,$3,$4,$5,$6)", [id, user?.id || "", visibility, originalName, mime, file.size]);
  return visibility === "public" ? { file_url: `/api/files/${id}`, file_uri: `vps:${id}` } : { file_uri: `vps:${id}` };
}

export async function signedFileUrl(fileUri, request, expiresIn = 3600, user = null) {
  const id = String(fileUri || "").replace(/^vps:/, "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Referência do arquivo inválida.");
  await ensureDatabase();
  const { rows } = await getPool().query("SELECT id,visibility,owner_id FROM vps_files WHERE id=$1", [id]);
  if (!rows[0]) throw new Error("Arquivo não encontrado.");
  if (rows[0].visibility !== "public" && rows[0].owner_id !== user?.id && user?.role !== "admin" && !await isStaffOrderFile(id, user)) {
    throw Object.assign(new Error("Você não tem acesso a este arquivo."), { status: 403 });
  }
  if (rows[0].visibility === "public") return { signed_url: new URL(`/api/files/${id}`, request.url).toString() };
  const expires = Math.floor(Date.now() / 1000) + Math.min(24 * 3600, Math.max(60, Number(expiresIn) || 3600));
  const token = signature(id, expires, user.id);
  const url = new URL(`/api/files/${id}?expires=${expires}&token=${encodeURIComponent(token)}`, request.url);
  return { signed_url: url.toString(), expires_at: new Date(expires * 1000).toISOString() };
}

export async function availableDraftFiles(ids, ownerId) {
  if (!ids.length) return [];
  await ensureDatabase();
  const { rows } = await getPool().query(
    "SELECT id FROM vps_files WHERE owner_id=$1 AND visibility='private' AND id=ANY($2::text[])",
    [ownerId, ids],
  );
  const existing = await Promise.all(rows.map(async ({ id }) => (
    (await stat(filePath("private", id)).catch(() => null))?.isFile() ? id : null
  )));
  return existing.filter(Boolean);
}

export async function serveFile(request, id, owner = null) {
  await ensureDatabase();
  const { rows } = await getPool().query("SELECT * FROM vps_files WHERE id=$1", [id]);
  const file = rows[0];
  if (!file) return new Response("Arquivo não encontrado", { status: 404 });
  const url = new URL(request.url);
  if (file.visibility !== "public" && !(url.searchParams.get("draft") === "1" && owner?.id && owner.id === file.owner_id)) {
    const expires = Number(url.searchParams.get("expires"));
    const token = url.searchParams.get("token") || "";
    if (!owner?.id || (file.owner_id !== owner.id && owner.role !== "admin" && !await isStaffOrderFile(id, owner))) {
      return new Response("Arquivo indisponível para esta conta.", { status: 403 });
    }
    const expected = signature(id, expires, owner.id);
    const a = Buffer.from(token); const b = Buffer.from(expected);
    if (!expires || expires < Date.now() / 1000 || a.length !== b.length || !timingSafeEqual(a, b)) {
      return new Response("Link de arquivo inválido ou expirado", { status: 403 });
    }
  }
  const bytes = await readFile(filePath(file.visibility, id)).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!bytes) return new Response("Arquivo não encontrado", { status: 404 });
  const disposition = file.mime_type.startsWith("image/") || file.mime_type === "application/pdf" ? "inline" : "attachment";
  return new Response(bytes, { headers: {
    "content-type": file.mime_type,
    "content-length": String(file.byte_size),
    "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
    "cache-control": file.visibility === "public" ? "public, max-age=3600" : "private, no-store",
    "x-content-type-options": "nosniff",
  } });
}

export async function fileDataUri(fileUri) {
  const id = String(fileUri || "").replace(/^vps:/, "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Referência do arquivo inválida.");
  await ensureDatabase();
  const { rows } = await getPool().query("SELECT visibility,mime_type FROM vps_files WHERE id=$1", [id]);
  if (!rows[0]) throw new Error("Arquivo não encontrado.");
  const bytes = await readFile(filePath(rows[0].visibility, id));
  return `data:${rows[0].mime_type};base64,${bytes.toString("base64")}`;
}
