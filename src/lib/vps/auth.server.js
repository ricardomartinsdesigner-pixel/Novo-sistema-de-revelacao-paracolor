import { createHmac, randomInt, randomUUID } from "node:crypto";
import { getPool, ensureDatabase, newPasswordHash, safeUser, verifyPassword } from "./db.server";
import { clearSessionCookie, issueSession, sessionCookie } from "./session.server";
import { makeServerBase44 } from "./server-client.server";
import { sendStoreEmail } from "@/lib/smtp-transport.server";
import { isAllowedCustomerPassword } from "@/lib/password-policy";

const emailValue = (value) => String(value || "").trim().toLowerCase();
const publicOrigin = (request) => (process.env.PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
const codeHash = (value) => createHmac("sha256", process.env.SESSION_SECRET).update(String(value)).digest("hex");
const response = (data, status = 200, cookie) => Response.json(data, { status, headers: cookie ? { "set-cookie": cookie, "cache-control": "no-store" } : { "cache-control": "no-store" } });
const errorResponse = (error) => response({ error: error.message || "Não foi possível concluir a operação." }, error.status || 400);

async function sendCode(request, email, code, purpose) {
  const base44 = makeServerBase44(request);
  const store = await base44.asServiceRole.entities.Settings.list({ sort: "-created_date", limit: 1 });
  const settings = store.items?.[0] || {};
  if (settings.email_enabled === false) throw new Error("O envio de e-mails está desativado nas configurações da loja.");
  await sendStoreEmail(base44, settings, {
    to: email,
    subject: `${settings.store_name || "Paracolor"} · código de confirmação`,
    text: `Seu código para ${purpose === "register" ? "confirmar o cadastro" : "redefinir a senha"} é ${code}. Ele expira em 15 minutos.`,
    html: `<p>Seu código é <strong>${code}</strong>.</p><p>Ele expira em 15 minutos.</p>`,
  });
}

async function saveOtp(email, purpose, code, payload = {}) {
  await getPool().query(
    `INSERT INTO vps_otps(email,purpose,code_hash,payload,expires_at,attempts)
     VALUES($1,$2,$3,$4,now()+interval '15 minutes',0)
     ON CONFLICT(email,purpose) DO UPDATE SET code_hash=excluded.code_hash,payload=excluded.payload,expires_at=excluded.expires_at,attempts=0`,
    [email, purpose, codeHash(code), payload],
  );
}

async function register(request, data) {
  await ensureDatabase();
  const email = emailValue(data.email);
  const password = String(data.password || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 160) throw new Error("Informe um e-mail válido.");
  if (!isAllowedCustomerPassword(password)) throw new Error("A senha precisa ter de 8 a 160 caracteres.");
  const existing = await getPool().query("SELECT id FROM vps_records WHERE entity='User' AND lower(data->>'email')=$1 LIMIT 1", [email]);
  if (existing.rowCount) throw new Error("Este e-mail já possui uma conta.");
  const code = String(randomInt(100000, 1000000));
  await saveOtp(email, "register", code, { full_name: String(data.full_name || "").trim().slice(0, 160), password_hash: newPasswordHash(password) });
  try { await sendCode(request, email, code, "register"); }
  catch (error) { await getPool().query("DELETE FROM vps_otps WHERE email=$1 AND purpose='register'", [email]); throw error; }
  return response({ ok: true, verification_required: true });
}

async function verify(request, data) {
  const email = emailValue(data.email); const code = String(data.otpCode || "");
  const result = await getPool().query("SELECT * FROM vps_otps WHERE email=$1 AND purpose='register' AND expires_at>now() AND attempts<6", [email]);
  const otp = result.rows[0];
  if (!otp || codeHash(code) !== otp.code_hash) {
    if (otp) await getPool().query("UPDATE vps_otps SET attempts=attempts+1 WHERE email=$1 AND purpose='register'", [email]);
    throw Object.assign(new Error("Código inválido ou expirado."), { status: 400 });
  }
  const profile = otp.payload || {};
  const id = randomUUID();
  const user = { id, email, full_name: profile.full_name || "", phone: "", address: "", role: "user", is_verified: true, password_hash: profile.password_hash };
  await getPool().query("INSERT INTO vps_records(entity,id,created_by_id,data) VALUES('User',$1,$1,$2)", [id, user]);
  await getPool().query("DELETE FROM vps_otps WHERE email=$1 AND purpose='register'", [email]);
  return response({ ok: true, user: safeUser(user) }, 200, sessionCookie(issueSession(id)));
}

async function login(data) {
  await ensureDatabase();
  const email = emailValue(data.email);
  const { rows } = await getPool().query("SELECT id,data FROM vps_records WHERE entity='User' AND lower(data->>'email')=$1 LIMIT 1", [email]);
  const user = rows[0]?.data;
  if (!user || !verifyPassword(String(data.password || ""), user.password_hash)) throw Object.assign(new Error("E-mail ou senha inválidos."), { status: 401 });
  if (user.is_verified !== true) throw new Error("Confirme seu e-mail antes de entrar.");
  return response({ user: safeUser(user) }, 200, sessionCookie(issueSession(rows[0].id)));
}

async function resend(request, data) {
  const email = emailValue(data.email);
  const existing = await getPool().query("SELECT id FROM vps_records WHERE entity='User' AND lower(data->>'email')=$1 LIMIT 1", [email]);
  if (existing.rowCount) throw new Error("Esta conta já foi confirmada ou já está cadastrada.");
  const pending = await getPool().query("SELECT payload FROM vps_otps WHERE email=$1 AND purpose='register' AND expires_at>now()", [email]);
  if (!pending.rowCount) throw new Error("Cadastro não encontrado ou código expirado. Inicie o cadastro novamente.");
  const code = String(randomInt(100000, 1000000));
  await saveOtp(email, "register", code, pending.rows[0].payload);
  await sendCode(request, email, code, "register");
  return response({ ok: true });
}

async function forgot(request, data) {
  const email = emailValue(data.email);
  const { rows } = await getPool().query("SELECT id FROM vps_records WHERE entity='User' AND lower(data->>'email')=$1 LIMIT 1", [email]);
  if (!rows[0]) return response({ ok: true });
  const token = randomUUID() + randomUUID().replaceAll("-", "");
  await getPool().query(
    `INSERT INTO vps_otps(email,purpose,code_hash,payload,expires_at,attempts) VALUES($1,'reset',$2,$3,now()+interval '15 minutes',0)
     ON CONFLICT(email,purpose) DO UPDATE SET code_hash=$2,payload=$3,expires_at=now()+interval '15 minutes',attempts=0`,
    [email, codeHash(token), { user_id: rows[0].id }],
  );
  const origin = publicOrigin(request);
  const base44 = makeServerBase44(request);
  const settingsRows = await base44.asServiceRole.entities.Settings.list({ sort: "-created_date", limit: 1 });
  const settings = settingsRows.items?.[0] || {};
  await sendStoreEmail(base44, settings, {
    to: email,
    subject: `${settings.store_name || "Paracolor"} · redefinição de senha`,
    text: `Acesse ${origin}/reset-password?token=${encodeURIComponent(token)} para criar uma nova senha. O link expira em 15 minutos.`,
    html: `<p><a href="${origin}/reset-password?token=${encodeURIComponent(token)}">Criar nova senha</a></p><p>O link expira em 15 minutos.</p>`,
  });
  return response({ ok: true });
}

async function reset(data) {
  const token = String(data.resetToken || data.token || "");
  const password = String(data.newPassword || "");
  if (!isAllowedCustomerPassword(password)) throw new Error("A senha precisa ter de 8 a 160 caracteres.");
  const { rows } = await getPool().query("SELECT email,payload FROM vps_otps WHERE purpose='reset' AND code_hash=$1 AND expires_at>now()", [codeHash(token)]);
  const otp = rows[0];
  if (!otp) throw new Error("Link inválido ou expirado.");
  await getPool().query("UPDATE vps_records SET data=jsonb_set(data,'{password_hash}',$2::jsonb),updated_at=now() WHERE entity='User' AND id=$1", [otp.payload.user_id, JSON.stringify(newPasswordHash(password))]);
  await getPool().query("DELETE FROM vps_otps WHERE email=$1 AND purpose='reset'", [otp.email]);
  return response({ ok: true });
}

async function enforceRateLimit(request, action) {
  const limits = { login: [10, 900], register: [5, 3600], verify: [8, 900], resend: [3, 3600], forgot: [4, 3600], reset: [8, 900] };
  const policy = limits[action];
  if (!policy) return;
  const forwarded = request.headers.get("x-forwarded-for") || "unknown";
  const ip = forwarded.split(",").at(-1).trim().slice(0, 80);
  const key = codeHash(`${action}:${ip}`);
  const [maximum, seconds] = policy;
  const { rows } = await getPool().query(
    `INSERT INTO vps_rate_limits(key,window_started_at,hits) VALUES($1,now(),1)
     ON CONFLICT(key) DO UPDATE SET
       hits=CASE WHEN vps_rate_limits.window_started_at < now()-($2 * interval '1 second') THEN 1 ELSE vps_rate_limits.hits+1 END,
       window_started_at=CASE WHEN vps_rate_limits.window_started_at < now()-($2 * interval '1 second') THEN now() ELSE vps_rate_limits.window_started_at END
     RETURNING hits`,
    [key, seconds],
  );
  if (rows[0].hits > maximum) throw Object.assign(new Error("Muitas tentativas. Aguarde antes de tentar novamente."), { status: 429 });
}

export async function handleAuth(request, action, currentUser) {
  await ensureDatabase();
  try {
    await enforceRateLimit(request, action);
    if (request.method === "GET" && action === "me") return currentUser ? response({ user: currentUser }) : response({ error: "Sessão encerrada." }, 401);
    const data = await request.json().catch(() => ({}));
    if (action === "register") return await register(request, data);
    if (action === "verify") return await verify(request, data);
    if (action === "resend") return await resend(request, data);
    if (action === "login") return await login(data);
    if (action === "logout") return response({ ok: true }, 200, clearSessionCookie());
    if (action === "forgot") return await forgot(request, data);
    if (action === "reset") return await reset(data);
    if (action === "update" && currentUser) {
      const patch = { full_name: String(data.full_name || currentUser.full_name || "").trim().slice(0, 160), phone: String(data.phone || "").slice(0, 40), address: String(data.address || "").slice(0, 400) };
      await getPool().query("UPDATE vps_records SET data=data||$2::jsonb,updated_at=now() WHERE entity='User' AND id=$1", [currentUser.id, patch]);
      return response({ ok: true });
    }
    if (["login", "register", "verify", "resend", "forgot", "reset"].includes(action)) return response({ error: "Operação não permitida." }, 405);
    return response({ error: "Não autorizado." }, 401);
  } catch (error) { return errorResponse(error); }
}
