import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { ensureDatabase, getPool, withTransaction } from "@/lib/vps/db.server";
import { readPaymentProviders, prepareProviderConfig, providerCredentials, paymentWebhookUrl, paymentsSandbox } from "@/lib/payment-provider-config.server";
import { testProvider } from "@/lib/payment-adapters.server";
import { NEW_PAYMENT_METHODS } from "@/lib/payment-providers";
import { securityKeyConfigured } from "@/lib/security-secrets.server";

const providerId = z.enum(NEW_PAYMENT_METHODS);
const credentials = z.object({
  apiKey: z.string().trim().max(500).optional(), handle: z.string().trim().max(100).optional(),
  clientId: z.string().trim().max(500).optional(), clientSecret: z.string().trim().max(1000).optional(),
  certificate: z.string().trim().max(16000).optional(), privateKey: z.string().trim().max(16000).optional(),
  passphrase: z.string().max(500).optional(), pixKey: z.string().trim().max(150).optional(),
  tokenUrl: z.string().trim().max(200).optional(), apiUrl: z.string().trim().max(200).optional(),
});

function assertAdmin(user) {
  if (user.role !== "admin") throw new Error("Acesso exclusivo de administradores.");
}

export const paymentProviderSettings = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    assertAdmin(context.user);
    let callback = "";
    try { if (context.user.admin_mfa_enabled || paymentsSandbox()) callback = paymentWebhookUrl("pagarme"); } catch { /* show configuration guidance in the panel */ }
    const providers = (await readPaymentProviders()).map(({ id, enabled, mode, priority, tested, secret }) => ({
      id, enabled, mode, priority, tested: Boolean(tested), configured: Boolean(secret),
    }));
    return { providers, callback, keyConfigured: securityKeyConfigured(), sandbox: paymentsSandbox() };
  });

export const savePaymentProvider = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: providerId, enabled: z.boolean(), mode: z.enum(["teste", "producao"]), priority: z.number().int().min(1).max(999), credentials }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.user);
    if (data.enabled && data.mode === "producao" && !context.user.admin_mfa_enabled) {
      throw new Error("Ative a autenticação em duas etapas antes de habilitar pagamentos em produção.");
    }
    return withTransaction(async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 7))", [data.id]);
      const previous = (await readPaymentProviders(db)).find((row) => row.id === data.id);
      const next = prepareProviderConfig(previous, data);
      await db.query(
        `INSERT INTO vps_records(entity,id,created_by_id,data) VALUES('PaymentProviderConfig',$1,$2,$3)
         ON CONFLICT(entity,id) DO UPDATE SET data=excluded.data, updated_at=now()`,
        [data.id, context.user.id, next],
      );
      return { ok: true };
    });
  });

export const testPaymentProvider = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: providerId }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.user);
    await ensureDatabase();
    const config = (await readPaymentProviders()).find((row) => row.id === data.id);
    if (!Object.keys(providerCredentials(config)).length) throw new Error("Salve as credenciais antes de testar.");
    let message;
    try { message = await testProvider(config); }
    catch { throw new Error("A API não confirmou a conexão. Confira as credenciais, o ambiente e a habilitação da conta."); }
    const saved = await getPool().query(
      `UPDATE vps_records SET data=data || '{"tested":true}'::jsonb, updated_at=now()
       WHERE entity='PaymentProviderConfig' AND id=$1 AND data->>'secret'=$2`,
      [data.id, config.secret],
    );
    if (!saved.rowCount) throw new Error("As credenciais foram alteradas. Teste novamente.");
    return { message };
  });
