import { z } from "zod";
import { loadIntegrationConfig } from "@/lib/integrations.server";

export const smtpInput = z.object({
  host: z.string().trim().min(1, "Informe o servidor SMTP.").max(253)
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i, "Informe o nome público do servidor SMTP, sem protocolo ou porta.")
    .refine((host) => !/\.(local|localhost|internal|invalid|test|onion)$/i.test(host), "Use um servidor SMTP público."),
  port: z.union([z.literal(465), z.literal(587), z.literal(2525)]),
  security: z.enum(["tls", "starttls"]),
  username: z.string().trim().min(1, "Informe o usuário SMTP.").max(320).regex(/^[^\r\n\0]+$/),
  password: z.string().max(1024).refine((value) => !value.includes("\0"), "Senha SMTP inválida.").optional(),
  from_email: z.string().trim().max(254).email("Informe um e-mail de remetente válido."),
});

export function publicSmtpConfig(config) {
  return {
    host: config?.smtp_host || "",
    port: config?.smtp_port || 465,
    security: config?.smtp_security || "tls",
    username: config?.smtp_username || "",
    from_email: config?.smtp_from_email || "",
    has_password: Boolean(config?.smtp_password),
  };
}

export async function loadSmtpConfig(base44) {
  const stored = await loadIntegrationConfig(base44);
  if (!stored?.smtp_host || !stored?.smtp_password || !stored?.smtp_from_email) {
    throw new Error("Cadastre e salve o servidor, usuário, senha e remetente SMTP em Mensagens antes de enviar.");
  }
  return smtpInput.parse({ ...publicSmtpConfig(stored), password: stored.smtp_password });
}