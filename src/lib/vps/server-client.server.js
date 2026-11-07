import { createHmac, randomBytes } from "node:crypto";
import { getPool } from "./db.server";
import { makeEntityService } from "./entities.server";
import { fileDataUri, saveUploadedFile, signedFileUrl } from "./files.server";
import { sendStoreEmail } from "@/lib/smtp-transport.server";

const digest = (value) => createHmac("sha256", process.env.SESSION_SECRET).update(String(value)).digest("hex");

function coreFor(request, user, bypass = false) {
  return {
    async UploadPrivateFile({ file }) { return saveUploadedFile(file, user, "private"); },
    async UploadPublicFile({ file }) { return saveUploadedFile(file, user, "public"); },
    async CreateFileSignedUrl({ file_uri, expires_in }) {
      if (bypass) return { signed_url: await fileDataUri(file_uri) };
      return signedFileUrl(file_uri, request, expires_in, user);
    },
  };
}

export function makeServerBase44(request, user = null) {
  const service = makeEntityService(user, false);
  const admin = makeEntityService(user, true);
  const client = {
    ...service,
    auth: { async me() { if (!user) throw Object.assign(new Error("Não autorizado."), { status: 401 }); return user; } },
    integrations: { Core: coreFor(request, user, false) },
    users: {
      async inviteUser(email, role = "user") {
        if (user?.role !== "admin") throw Object.assign(new Error("Apenas administradores podem convidar usuários."), { status: 403 });
        const normalized = String(email || "").trim().toLowerCase();
        const found = await getPool().query("SELECT id FROM vps_records WHERE entity='User' AND lower(data->>'email')=$1 LIMIT 1", [normalized]);
        if (!found.rowCount) throw new Error("O usuário precisa criar a conta antes de ser convidado.");
        const token = randomBytes(32).toString("base64url");
        await getPool().query(
          `INSERT INTO vps_otps(email,purpose,code_hash,payload,expires_at) VALUES($1,'reset',$2,$3,now()+interval '30 minutes')
           ON CONFLICT(email,purpose) DO UPDATE SET code_hash=$2,payload=$3,expires_at=now()+interval '30 minutes',attempts=0`,
          [normalized, digest(token), { user_id: found.rows[0].id, invited_role: role }],
        );
        const settingsResult = await admin.entities.Settings.list({ sort: "-created_date", limit: 1 });
        const settings = settingsResult.items?.[0] || {};
        const origin = (process.env.PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
        await sendStoreEmail(client, settings, {
          to: normalized,
          subject: `${settings.store_name || "Paracolor"} · acesso à equipe`,
          text: `Crie ou altere sua senha: ${origin}/reset-password?token=${encodeURIComponent(token)}`,
          html: `<p>Crie ou altere sua senha para acessar a equipe:</p><p><a href="${origin}/reset-password?token=${encodeURIComponent(token)}">Definir senha</a></p>`,
        });
        return { invited: true };
      },
    },
  };
  client.asServiceRole = {
    ...admin,
    integrations: { Core: coreFor(request, user, true) },
    aiGateway: { connection() { throw new Error("O gateway de IA Base44 não está disponível na instalação VPS."); } },
  };
  return client;
}
