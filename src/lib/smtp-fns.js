import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/auth-middleware";
import { loadIntegrationConfig } from "@/lib/integrations.server";
import { publicSmtpConfig, smtpInput } from "@/lib/smtp-config.server";

function adminOnly(context) {
  if (context.user.role !== "admin") throw new Error("Apenas administradores podem configurar o SMTP.");
}

export const getSmtpSettings = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    adminOnly(context);
    return publicSmtpConfig(await loadIntegrationConfig(context.getBase44()));
  });

export const saveSmtpSettings = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(smtpInput)
  .handler(async ({ data, context }) => {
    adminOnly(context);
    const base44 = context.getBase44();
    const config = await loadIntegrationConfig(base44);
    if (!data.password && !config?.smtp_password) throw new Error("Informe a senha SMTP antes de salvar.");
    const patch = {
      smtp_host: data.host.toLowerCase(),
      smtp_port: data.port,
      smtp_security: data.security,
      smtp_username: data.username,
      smtp_from_email: data.from_email,
      ...(data.password ? { smtp_password: data.password } : {}),
    };
    const saved = config
      ? await base44.asServiceRole.entities.IntegrationConfig.update(config.id, patch)
      : await base44.asServiceRole.entities.IntegrationConfig.create(patch);
    return publicSmtpConfig(saved);
  });