import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/auth-middleware";
import { loadStoreSettings } from "@/lib/email.server";
import { sendStoreEmail } from "@/lib/smtp-transport.server";
import { loadSmtpConfig } from "@/lib/smtp-config.server";

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem enviar o teste.");
    const base44 = context.getBase44();
    const settings = await loadStoreSettings(base44);
    const storeName = settings.store_name || "Paracolor";
    try {
      const smtp = await loadSmtpConfig(base44);
      // O teste valida o remetente que acabou de ser configurado. Isso evita
      // depender do e-mail do perfil administrativo como destinatário.
      await sendStoreEmail(base44, { ...settings, email_reply_to: "" }, {
        to: smtp.from_email,
        subject: `${storeName} · teste de envio de e-mail`,
        html: `<div style="font-family:Inter,Arial,sans-serif;padding:24px;color:#1F1A17">
          <p style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#86756A">Teste SMTP da loja</p>
          <h1 style="font-size:22px;margin:8px 0 12px">Seus e-mails estão funcionando</h1>
          <p style="font-size:14px;line-height:1.6">Este é um envio de teste do painel administrativo. Os avisos de pedido, pagamento, arte e entrega usam o mesmo caminho.</p>
        </div>`,
        text: `Seus e-mails estão funcionando. Este é um envio de teste do painel da ${storeName}.`,
      });
      return { ok: true, message: `O SMTP aceitou o envio de teste para ${smtp.from_email}. Confira também a pasta de spam.` };
    } catch (error) {
      return { ok: false, message: error?.message || "Não foi possível enviar o teste." };
    }
  });
