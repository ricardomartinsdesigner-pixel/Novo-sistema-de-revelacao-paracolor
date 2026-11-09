import { createHmac, randomBytes } from "node:crypto";
import { getPool, verifyPassword, withTransaction } from "./db.server.js";
import { openSecret, privateToken, sameToken, sealSecret } from "../security-secrets.server.js";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const scope = (id) => "admin-mfa:" + id;
const recoveryHash = (id, code) => privateToken(scope(id) + ":recovery:" + code);

function base32(bytes) {
  let value = 0, bits = 0, result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >>> bits) & 31];
    }
  }
  return result + (bits ? alphabet[(value << (5 - bits)) & 31] : "");
}

export function totpCode(key, counter) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", key).update(message).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

function matchingStep(key, code) {
  if (!/^\d{6}$/.test(code)) return -1;
  const now = Math.floor(Date.now() / 30000);
  return [now, now - 1, now + 1].find((step) => sameToken(code, totpCode(key, step))) ?? -1;
}

async function factor(db, id, lock = false) {
  const { rows } = await db.query("SELECT data FROM vps_records WHERE entity='AdminSecondFactor' AND id=$1" + (lock ? " FOR UPDATE" : ""), [id]);
  return rows[0]?.data;
}

export async function adminMfaEnabled(id) {
  return (await factor(getPool(), id))?.enabled === true;
}

export async function beginAdminMfa(user, password) {
  return withTransaction(async (db) => {
    const { rows } = await db.query("SELECT data FROM vps_records WHERE entity='User' AND id=$1 FOR UPDATE", [user.id]);
    const current = rows[0]?.data;
    if (current?.role !== "admin" || !verifyPassword(password, current.password_hash)) throw new Error("Confirme a senha do administrador.");
    if ((await factor(db, user.id, true))?.enabled) throw new Error("A autenticação em duas etapas já está ativa.");
    const key = randomBytes(20);
    const secret = base32(key);
    const data = { enabled: false, key: sealSecret(key.toString("hex"), scope(user.id)), expiresAt: Date.now() + 600_000 };
    await db.query(
      `INSERT INTO vps_records(entity,id,created_by_id,data) VALUES('AdminSecondFactor',$1,$1,$2)
       ON CONFLICT(entity,id) DO UPDATE SET data=excluded.data, updated_at=now()`, [user.id, data],
    );
    const uri = `otpauth://totp/${encodeURIComponent("Paracolor:" + user.email)}?secret=${secret}&issuer=Paracolor&period=30&digits=6`;
    return { secret, uri };
  });
}

export async function confirmAdminMfa(user, code) {
  return withTransaction(async (db) => {
    const state = await factor(db, user.id, true);
    if (!state || state.enabled || state.expiresAt < Date.now()) throw new Error("O cadastro expirou. Gere um novo QR Code.");
    const key = Buffer.from(openSecret(state.key, scope(user.id)), "hex");
    const step = matchingStep(key, code);
    if (step < 0) throw new Error("Código inválido. Confira o aplicativo autenticador.");
    const codes = Array.from({ length: 8 }, () => randomBytes(10).toString("hex"));
    const next = { enabled: true, key: state.key, lastStep: step, recovery: codes.map((value) => recoveryHash(user.id, value)) };
    await db.query("UPDATE vps_records SET data=$2, updated_at=now() WHERE entity='AdminSecondFactor' AND id=$1", [user.id, next]);
    return codes;
  });
}

export async function verifyAdminMfa(id, code) {
  return withTransaction(async (db) => {
    const state = await factor(db, id, true);
    if (!state?.enabled) return false;
    const key = Buffer.from(openSecret(state.key, scope(id)), "hex");
    const step = matchingStep(key, code);
    if (step > state.lastStep) {
      state.lastStep = step;
    } else if (/^[a-f0-9]{20}$/.test(code)) {
      const hash = recoveryHash(id, code);
      const index = state.recovery.findIndex((stored) => sameToken(hash, stored));
      if (index < 0) return false;
      state.recovery.splice(index, 1);
    } else { return false; }
    await db.query("UPDATE vps_records SET data=$2, updated_at=now() WHERE entity='AdminSecondFactor' AND id=$1", [id, state]);
    return true;
  });
}
