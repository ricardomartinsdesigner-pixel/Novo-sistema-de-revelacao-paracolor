import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { loadIntegrationConfig } from "@/lib/integrations.server";

function mask(token) {
  const value = (token ?? "").trim();
  if (!value) return "";
  return `••••••••${value.slice(-4)}`;
}

function adminOnly(context) {
  if (context.user.role !== "admin") throw new Error("Apenas administradores podem gerenciar as integrações.");
}

export const getIntegrations = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    adminOnly(context);
    const config = await loadIntegrationConfig(context.getBase44());
    return {
      mercadopago: {
        enabled: config?.mp_enabled === true,
        configured: Boolean((config?.mp_access_token ?? process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "").trim()),
        token_hint: mask(config?.mp_access_token ?? process.env.MERCADO_PAGO_ACCESS_TOKEN),
        webhook_configured: Boolean((config?.mp_webhook_secret ?? process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "").trim()),
        webhook_secret_hint: mask(config?.mp_webhook_secret ?? process.env.MERCADO_PAGO_WEBHOOK_SECRET),
        payment_mode: (config?.mp_access_token ?? process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "").startsWith("TEST-") ? "teste" : "produção",
        webhook_url: `${process.env.PUBLIC_APP_URL || ""}/api/mercadopago-webhook`,
        account: config?.mp_account ?? "",
        last_check: config?.mp_last_check ?? "",
      },
      melhor_envio: {
        enabled: config?.me_enabled === true,
        configured: Boolean((config?.me_token ?? process.env.MELHOR_ENVIO_TOKEN ?? "").trim()),
        token_hint: mask(config?.me_token ?? process.env.MELHOR_ENVIO_TOKEN),
        sandbox: config?.me_sandbox !== false,
        from_cep: config?.me_from_cep ?? "",
        contact_email: config?.me_contact_email ?? process.env.MELHOR_ENVIO_CONTACT_EMAIL ?? "",
        package_width: Number(config?.me_package_width ?? process.env.MELHOR_ENVIO_PACKAGE_WIDTH ?? 22),
        package_height: Number(config?.me_package_height ?? process.env.MELHOR_ENVIO_PACKAGE_HEIGHT ?? 6),
        package_length: Number(config?.me_package_length ?? process.env.MELHOR_ENVIO_PACKAGE_LENGTH ?? 30),
        package_weight: Number(config?.me_package_weight ?? process.env.MELHOR_ENVIO_PACKAGE_WEIGHT ?? 0.4),
        account: config?.me_account ?? "",
        last_check: config?.me_last_check ?? "",
      },
    };
  });

export const saveIntegrations = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      mercadopago: z
        .object({
          enabled: z.boolean(),
          token: z.string().max(600).optional(),
          webhook_secret: z.string().max(300).optional(),
        })
        .optional(),
      melhor_envio: z
        .object({
          enabled: z.boolean(),
          token: z.string().max(1200).optional(),
          sandbox: z.boolean(),
          from_cep: z.string().max(9).optional(),
          contact_email: z.string().email().max(250).or(z.literal("")).optional(),
          package_width: z.number().min(1).max(200).optional(),
          package_height: z.number().min(1).max(200).optional(),
          package_length: z.number().min(1).max(200).optional(),
          package_weight: z.number().min(0.01).max(30).optional(),
        })
        .optional(),
    })
  )
  .handler(async ({ data, context }) => {
    adminOnly(context);
    const role = context.getBase44().asServiceRole;
    const config = await loadIntegrationConfig(context.getBase44());
    if (data.mercadopago?.enabled) {
      const token = (data.mercadopago.token || config?.mp_access_token || process.env.MERCADO_PAGO_ACCESS_TOKEN || "").trim();
      const secret = (data.mercadopago.webhook_secret || config?.mp_webhook_secret || process.env.MERCADO_PAGO_WEBHOOK_SECRET || "").trim();
      if (!token || !secret) throw new Error("Para ativar pagamentos, informe o Access Token e a chave secreta do Webhook.");
    }
    if (data.melhor_envio?.enabled) {
      const token = (data.melhor_envio.token || config?.me_token || process.env.MELHOR_ENVIO_TOKEN || "").trim();
      const postalCode = (data.melhor_envio.from_cep ?? config?.me_from_cep ?? "").replace(/\D/g, "");
      const email = (data.melhor_envio.contact_email ?? config?.me_contact_email ?? process.env.MELHOR_ENVIO_CONTACT_EMAIL ?? "").trim();
      if (!token || postalCode.length !== 8 || !email) throw new Error("Para ativar cotações do Melhor Envio, informe token, CEP de origem com 8 dígitos e e-mail de contato.");
    }
    const patch = {};

    if (data.mercadopago) {
      patch.mp_enabled = data.mercadopago.enabled;
      const token = (data.mercadopago.token ?? "").trim();
      if (token) patch.mp_access_token = token;
      const webhookSecret = (data.mercadopago.webhook_secret ?? "").trim();
      if (webhookSecret) patch.mp_webhook_secret = webhookSecret;
    }
    if (data.melhor_envio) {
      patch.me_enabled = data.melhor_envio.enabled;
      patch.me_sandbox = data.melhor_envio.sandbox;
      patch.me_from_cep = (data.melhor_envio.from_cep ?? "").replace(/\D/g, "");
      patch.me_contact_email = (data.melhor_envio.contact_email ?? "").trim().toLowerCase();
      patch.me_package_width = data.melhor_envio.package_width ?? 22;
      patch.me_package_height = data.melhor_envio.package_height ?? 6;
      patch.me_package_length = data.melhor_envio.package_length ?? 30;
      patch.me_package_weight = data.melhor_envio.package_weight ?? 0.4;
      const token = (data.melhor_envio.token ?? "").trim();
      if (token) patch.me_token = token;
    }

    if (config) await role.entities.IntegrationConfig.update(config.id, patch);
    else await role.entities.IntegrationConfig.create(patch);

    return { ok: true };
  });

export const testMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    adminOnly(context);
    const role = context.getBase44().asServiceRole;
    const config = await loadIntegrationConfig(context.getBase44());
    const token = (config?.mp_access_token ?? process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "").trim();
    if (!token) return { ok: false, message: "Cadastre o Access Token do Mercado Pago primeiro." };

    const response = await fetch("https://api.mercadopago.com/users/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return { ok: false, message: `Mercado Pago recusou o token (código ${response.status}). Confira se o Access Token pertence ao ambiente correto.` };
    }
    const account = await response.json();
    const label = [account.nickname, account.email, account.id ? `ID ${account.id}` : ""].filter(Boolean).join(" · ");
    const checked = {
      mp_account: label,
      mp_last_check: new Date().toISOString(),
    };
    if (config?.id) await role.entities.IntegrationConfig.update(config.id, checked);
    else await role.entities.IntegrationConfig.create(checked);
    return { ok: true, message: `Conectado ao Mercado Pago${label ? `: ${label}` : "."}` };
  });

export const testMelhorEnvio = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    adminOnly(context);
    const role = context.getBase44().asServiceRole;
    const config = await loadIntegrationConfig(context.getBase44());
    const token = (config?.me_token ?? process.env.MELHOR_ENVIO_TOKEN ?? "").trim();
    if (!token) return { ok: false, message: "Cadastre o token do Melhor Envio primeiro." };
    const contactEmail = (config?.me_contact_email ?? process.env.MELHOR_ENVIO_CONTACT_EMAIL ?? "").trim();
    if (!contactEmail) return { ok: false, message: "Informe o e-mail de contato cadastrado no Melhor Envio." };

    const base = config?.me_sandbox === false ? "https://melhorenvio.com.br" : "https://sandbox.melhorenvio.com.br";
    const response = await fetch(`${base}/api/v2/me`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "user-agent": `Paracolor (${contactEmail})`,
      },
    });
    if (!response.ok) {
      return { ok: false, message: `Melhor Envio recusou o token (código ${response.status}). Confira o ambiente (sandbox ou produção).` };
    }
    const account = await response.json();
    const label = [account.firstname, account.lastname, account.email].filter(Boolean).join(" ");
    const checked = {
      me_account: label,
      me_last_check: new Date().toISOString(),
    };
    if (config?.id) await role.entities.IntegrationConfig.update(config.id, checked);
    else await role.entities.IntegrationConfig.create(checked);
    return { ok: true, message: `Conectado ao Melhor Envio${label ? `: ${label}` : "."}` };
  });
