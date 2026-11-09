import { adminMfaEnabled } from "./admin-mfa.server.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ensureDatabase, safeUser, getPool } from "./db.server";

const COOKIE = "paracolor_session";
const DAY = 24 * 60 * 60;
const secret = () => {
  const value = process.env.SESSION_SECRET || "";
  if (value.length < 32) throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres aleatórios.");
  return value;
};

function sign(value) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function issueSession(userId, mfa = false) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, mfa, exp: Math.floor(Date.now() / 1000) + 7 * DAY })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function sessionCookie(token, maxAge = 7 * DAY) {
  const secureEnabled = process.env.SESSION_COOKIE_SECURE === "true"
    || (process.env.SESSION_COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production");
  const secure = secureEnabled ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie() {
  const secureEnabled = process.env.SESSION_COOKIE_SECURE === "true"
    || (process.env.SESSION_COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production");
  const secure = secureEnabled ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function userFromRequest(request) {
  await ensureDatabase();
  const cookies = request.headers.get("cookie") || "";
  const token = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!decoded.sub || decoded.exp <= Date.now() / 1000) return null;
    const { rows } = await getPool().query("SELECT data FROM vps_records WHERE entity='User' AND id=$1", [decoded.sub]);
    const user = safeUser(rows[0]?.data);
    if (user?.role === "admin" && await adminMfaEnabled(user.id)) {
      if (!decoded.mfa) return null;
      return { ...user, admin_mfa_enabled: true };
    }
    return user;
  } catch {
    return null;
  }
}

export { COOKIE };
