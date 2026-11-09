import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { loadStoreSettings } from "@/lib/email.server";
import { sendStoreEmail } from "@/lib/smtp-transport.server";

const leadItem = z.object({
  name: z.string().min(1).max(160),
  qty: z.number().min(0).max(100000).optional(),
  total: z.number().min(0).max(1000000).optional(),
});

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// O carrinho é local: para lembrar quem abandonou, o servidor guarda um resumo
// do que a pessoa deixou selecionado (sem as fotos).
export const saveCartLead = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      items: z.array(leadItem).max(50),
      total: z.number().min(0).max(1000000),
    })
  )
  .handler(async ({ data, context }) => {
    const { user } = context;
    const role = context.getBase44().asServiceRole;
    const summary = data.items
      .map((item) => `${item.qty && item.qty > 1 ? `${item.qty}x ` : ""}${item.name}`)
      .join(" · ")
      .slice(0, 900);
    const payload = {
      user_id: user.id,
      customer_email: user.email,
      customer_name: user.full_name || "",
      items_summary: summary,
      item_count: data.items.length,
      total: data.total,
      last_activity: new Date().toISOString(),
      status: data.items.length ? "aberto" : "descartado",
    };
    const existing = (await role.entities.CartLead.filter({ user_id: user.id }, { limit: 1 })).items[0];
    if (existing) {
      if (!data.items.length && existing.status === "recuperado") return { ok: true, id: existing.id };
      await role.entities.CartLead.update(existing.id, payload);
      return { ok: true, id: existing.id };
    }
    const created = await role.entities.CartLead.create(payload);
    return { ok: true, id: created.id };
  });

export const sendCartReminder = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1).max(80), origin: z.string().max(200).optional() }))
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") {
      throw Object.assign(new Error("Apenas administradores podem enviar lembretes."), { status: 403 });
    }
    const base44 = context.getBase44();
    const lead = await base44.entities.CartLead.get(data.id);
    if (!["aberto","lembrete_enviado"].includes(lead.status) ||
        !(Date.parse(lead.last_activity) < Date.now() - 30 * 60_000)) {
      return { sent: false, reason: "Aguarde 30 minutos sem atividade antes de enviar o lembrete." };
    }
    if (Date.parse(lead.reminder_sent_date) > Date.now() - 24 * 60 * 60_000) {
      return { sent: false, reason: "Já foi enviado um lembrete nas últimas 24 horas." };
    }
    const settings = await loadStoreSettings(base44);
    if (settings.email_enabled === false) {
      return { sent: false, reason: "O envio de e-mails está desativado nas configurações." };
    }

    const storeName = settings.store_name || "Paracolor";
    const origin = process.env.PUBLIC_APP_URL || "";
    const link = /^https?:\/\//.test(origin) ? `${origin.replace(/\/$/, "")}/carrinho` : "";
    const name = lead.customer_name || "olá";
    const text = `Olá, ${name}.\n\nSeu carrinho na ${storeName} ficou salvo: ${lead.items_summary || "itens selecionados"}.\nTotal: ${money(lead.total)}\n\n${link ? `Continue de onde parou: ${link}\n\n` : ""}Qualquer dúvida, é só responder este e-mail.`;
    const html = `<div style="font-family:Inter,Arial,sans-serif;background:#FDFCFB;padding:28px">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #EDE7DF;border-radius:14px;padding:26px">
        <p style="margin:0 0 18px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#86756A">${esc(storeName)}</p>
        <h1 style="margin:0 0 12px;font-size:23px;color:#1F1A17">Seu carrinho está esperando</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3E3733">Olá, ${esc(name)}. Se estiver usando o mesmo navegador e aparelho, você pode voltar ao carrinho.</p>
        <p style="margin:0 0 4px;font-size:13px;color:#86756A">${esc(lead.items_summary || "Itens selecionados")}</p>
        <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:#1F1A17">Total: ${money(lead.total)}</p>
        ${link ? `<p style="margin:0 0 20px"><a href="${esc(link)}" style="background:#7A5636;color:#FDFCFB;text-decoration:none;padding:11px 20px;border-radius:999px;font-size:13px">Voltar ao carrinho</a></p>` : ""}
        <p style="margin:0;font-size:11px;color:#86756A">${esc(settings.email_reply_to || settings.email || "")}</p>
      </div>
    </div>`;

    try {
      await sendStoreEmail(base44, settings, {
        to: lead.customer_email,
        subject: `${storeName} · Seu carrinho está esperando`,
        html,
        text,
      });
      await base44.entities.CartLead.update(lead.id, {
        status: "lembrete_enviado",
        reminder_sent_date: new Date().toISOString(),
        reminder_count: (lead.reminder_count || 0) + 1,
      });
      return { sent: true };
    } catch (error) {
      return { sent: false, reason: error?.message || "Não foi possível enviar o e-mail." };
    }
  });