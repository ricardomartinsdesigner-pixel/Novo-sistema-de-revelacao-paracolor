import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { OrderInput, QuoteInput } from "@/lib/checkout-validation";
import { computeCheckout } from "@/lib/checkout-pricing.server";
import { saveCheckoutOrder } from "@/lib/checkout-orders.server";
import { getMelhorEnvioConfig, getMercadoPagoToken } from "@/lib/integrations.server";
import { notifyCustomer } from "@/lib/email.server";

const DEFAULT_SETTINGS = {
  store_name: "Paracolor",
  production_days: 3,
  auto_backup_enabled: true,
  auto_backup_time: "03:00",
  auto_backup_retention: 7,
  cutoff_hour: 17,
  holidays: [],
  retention_days: 90,
  retention_auto: true,
  maintenance_enabled: false,
  shipping_enabled: false,
  shipping_flat: 0,
  pickup_info: "Retirada na loja, avisamos por e-mail e WhatsApp quando o pedido estiver pronto.",
  wa_template_arte:
    "Olá! Aqui é a Paracolor. Segue a arte do pedido {pedido} para você conferir e aprovar. Responda esta mensagem dizendo se está tudo certo ou o que precisa ajustar.",
  wa_template_contato: "Olá! Vim pelo site da Paracolor e gostaria de falar sobre {pedido}.",
  module_revelacao: true,
  module_polaroids: true,
  module_banners: true,
  module_personalizados: true,
  module_molduras: true,
  module_molduras_online: false,
  module_aprovacao_whatsapp: true,
  module_destaques: true,
  module_promocoes: true,
};

function asArray(result) {
  if (Array.isArray(result)) return result;
  return result?.items ?? [];
}

// Quem executou a ação fica registrado como responsável no pedido.
function actorPatch(user, date = new Date().toISOString()) {
  return {
    last_action_by: user?.full_name || user?.email || "admin",
    last_action_email: user?.email ?? "",
    last_action_at: date,
  };
}

export const ensureSettings = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const base44 = context.getBase44();
  const existing = asArray(await base44.asServiceRole.entities.Settings.list({ sort: "-created_date", limit: 1 }));
  const settings = existing[0] ?? await base44.asServiceRole.entities.Settings.create(DEFAULT_SETTINGS);
  const shipping = await getMelhorEnvioConfig(base44).catch(() => ({ enabled: false }));
  return {
    ...settings,
    online_payment_enabled: Boolean(await getMercadoPagoToken(base44)),
    shipping_quote_enabled: Boolean(shipping?.enabled),
  };
});

export const quoteCheckout = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(QuoteInput)
  .handler(async ({ data, context }) => {
    const quote = await computeCheckout(context.getBase44().asServiceRole, data, DEFAULT_SETTINGS);
    return { subtotal: quote.subtotal, discount: quote.discount, shipping_cost: quote.shipping_cost, shipping_label: quote.shipping_label, total: quote.total,
      coupon_code: quote.coupon_code, items: quote.items.map(({ product_name, line_total, qty }) => ({ product_name, line_total, qty })) };
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(OrderInput)
  .handler(async ({ data, context }) => {
    const store = asArray(
      await context.getBase44().asServiceRole.entities.Settings.list({ sort: "-created_date", limit: 1 })
    )[0];
    if (store?.maintenance_enabled) throw new Error("A loja está em manutenção e novos pedidos estão pausados.");
    if (data.payment_method === "mercadopago" && !(await getMercadoPagoToken(context.getBase44()))) throw new Error("Pagamento online indisponível. Escolha combinar o pagamento na loja.");
    return saveCheckoutOrder(context.getBase44(), context.user, data, DEFAULT_SETTINGS);
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      order_id: z.string().min(1),
      status: z.enum(["aguardando_pagamento", "pagamento_aprovado", "aguardando_arte", "aguardando_aprovacao", "ajustes_solicitados", "arte_aprovada", "aguardando_producao", "em_producao", "aguardando_conferencia", "pronto", "enviado", "concluido", "cancelado"]),
      note: z.string().max(400).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem alterar o status.");
    const role = context.getBase44().asServiceRole;
    const order = await role.entities.Order.get(data.order_id);

    const productionStatuses = ["aguardando_producao", "em_producao", "aguardando_conferencia", "pronto", "enviado", "concluido"];
    if (productionStatuses.includes(data.status) && order.payment_status !== "aprovado") throw new Error("Confirme o pagamento antes de liberar a produção.");
    if (
      productionStatuses.includes(data.status) &&
      order.art_approval_requested &&
      order.art_approval_status !== "aprovada"
    ) {
      throw new Error("Este pedido precisa da aprovação da arte pelo cliente antes de ir para produção.");
    }

    const history = [
      ...(order.status_history ?? []),
      {
        status: data.status,
        date: new Date().toISOString(),
        by: context.user.full_name || context.user.email || "admin",
        note: data.note ?? "",
      },
    ];

    const updated = await role.entities.Order.update(data.order_id, {
      status: data.status,
      status_history: history,
      ...actorPatch(context.user),
      ...(data.status === "pagamento_aprovado" ? { payment_status: "aprovado" } : {}),
    });

    const emailKind = { pagamento_aprovado: "payment_approved", pronto: "order_ready", enviado: "shipped" }[data.status];
    if (emailKind) await notifyCustomer(context.getBase44(), updated, emailKind);
    return updated;
  });

const QUICK_PRESETS = {
  "1h": { label: "1 hora", minutes: 60 },
  "1d": { label: "1 dia", minutes: 1440 },
  "2d": { label: "2 dias", minutes: 2880 },
};

// Ações rápidas: manda para produção já com prazo e contagem regressiva.
export const startQuickProduction = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1), preset: z.enum(["1h", "1d", "2d"]) }))
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem alterar o status.");
    const role = context.getBase44().asServiceRole;
    const order = await role.entities.Order.get(data.order_id);
    if (order.payment_status !== "aprovado") throw new Error("Confirme o pagamento antes de liberar a produção.");
    if (order.art_approval_requested && order.art_approval_status !== "aprovada") {
      throw new Error("Este pedido precisa da aprovação da arte pelo cliente antes de ir para produção.");
    }

    const preset = QUICK_PRESETS[data.preset];
    const due = new Date(Date.now() + preset.minutes * 60 * 1000).toISOString();
    const history = [
      ...(order.status_history ?? []),
      {
        status: "em_producao",
        date: new Date().toISOString(),
        by: context.user.full_name || context.user.email || "admin",
        note: `Em produção — prazo de ${preset.label}`,
      },
    ];

    return role.entities.Order.update(data.order_id, {
      status: "em_producao",
      status_history: history,
      quick_due_at: due,
      quick_label: preset.label,
      ...actorPatch(context.user),
    });
  });

function deadlineLabel(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

// Prazo livre: a data/hora escolhida vira a contagem regressiva do pedido.
export const setOrderDeadline = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1), due_at: z.string().optional() }))
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem alterar o prazo.");
    const role = context.getBase44().asServiceRole;
    const order = await role.entities.Order.get(data.order_id);

    if (!data.due_at) {
      return role.entities.Order.update(order.id, { quick_due_at: "", quick_label: "", ...actorPatch(context.user) });
    }

    if (order.payment_status !== "aprovado") throw new Error("Confirme o pagamento antes de definir o prazo.");
    if (order.art_approval_requested && order.art_approval_status !== "aprovada") {
      throw new Error("Este pedido precisa da aprovação da arte pelo cliente antes de ir para produção.");
    }

    const due = new Date(data.due_at);
    if (Number.isNaN(due.getTime())) throw new Error("Data inválida.");
    if (due.getTime() <= Date.now()) throw new Error("Escolha um prazo no futuro.");
    if (due.getTime() > Date.now() + 60 * 24 * 60 * 60 * 1000) throw new Error("O prazo máximo é de 60 dias.");

    const label = deadlineLabel(due.getTime() - Date.now());
    const formatted = due.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    return role.entities.Order.update(order.id, {
      status: "em_producao",
      quick_due_at: due.toISOString(),
      quick_label: label,
      ...actorPatch(context.user),
      status_history: [
        ...(order.status_history ?? []),
        {
          status: "em_producao",
          date: new Date().toISOString(),
          by: context.user.full_name || context.user.email || "admin",
          note: `Em produção — prazo definido para ${formatted}`,
        },
      ],
    });
  });

// O prazo vence sozinho: quem abre a lista ou o pedido dispara esta conferência.
export const settleQuickDeadlines = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem concluir prazos de produção.");
    const role = context.getBase44().asServiceRole;
    const due = await role.entities.Order.filter(
      {
        quick_due_at: { $lte: new Date().toISOString(), $exists: true },
        status: { $nin: ["pronto", "enviado", "concluido", "cancelado"] },
      },
      { limit: 50 }
    );
    const expired = (due.items ?? []).filter(
      (order) => order.quick_due_at && new Date(order.quick_due_at).getTime() <= Date.now()
    );

    for (const order of expired) {
      await role.entities.Order.update(order.id, {
        status: "pronto",
        status_history: [
          ...(order.status_history ?? []),
          {
            status: "pronto",
            date: new Date().toISOString(),
            by: "automático",
            note: `Prazo de ${order.quick_label || "produção"} encerrado — pedido pronto`,
          },
        ],
      });
    }
    return { settled: expired.length };
  });

// Baixa de balcão: digita o número do pedido e ele sai como entregue/retirado.
export const releaseOrderByNumber = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ number: z.string().trim().min(1).max(40) }))
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem dar baixa em pedidos.");
    const role = context.getBase44().asServiceRole;
    const term = data.number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const page = await role.entities.Order.filter(
      {
        $or: [
          { order_number: { $regex: `^${term}$`, $options: "i" } },
          { internal_number: { $regex: `^${term}$`, $options: "i" } },
        ],
      },
      { sort: "-created_date", limit: 5 }
    );

    const matches = page.items ?? [];
    if (!matches.length) throw new Error(`Nenhum pedido encontrado com o número ${data.number}.`);
    const order = matches.find((item) => !["cancelado", "enviado", "concluido"].includes(item.status));
    const label = order?.internal_number || order?.order_number || matches[0].internal_number || matches[0].order_number;
    if (!order) {
      const closed = matches.some((item) => ["enviado", "concluido"].includes(item.status));
      throw new Error(closed ? `O pedido ${label} já teve baixa.` : `O pedido ${label} está cancelado.`);
    }
    if (order.payment_status !== "aprovado") throw new Error(`Confirme o pagamento do pedido ${label} antes de dar baixa.`);

    const entregue = order.fulfillment === "entrega";
    const updated = await role.entities.Order.update(order.id, {
      status: "concluido",
      status_history: [
        ...(order.status_history ?? []),
        {
          status: "concluido",
          date: new Date().toISOString(),
          by: context.user.full_name || context.user.email || "admin",
          note: entregue ? "Baixa de pedido — entregue ao cliente" : "Baixa de pedido — retirado na loja",
        },
      ],
      ...actorPatch(context.user),
    });

    await notifyCustomer(context.getBase44(), updated, "shipped");
    return { label, customer_name: order.customer_name, fulfillment: order.fulfillment };
  });

export const setArtApproval = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      order_id: z.string().min(1),
      action: z.enum(["enviada", "aprovada", "ajustes"]),
      note: z.string().max(600).optional(),
      art_file_uri: z.string().max(600).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem registrar a arte.");
    const role = context.getBase44().asServiceRole;
    const order = await role.entities.Order.get(data.order_id);

    const history = [
      ...(order.art_history ?? []),
      {
        date: new Date().toISOString(),
        action: data.action,
        by: context.user.full_name || context.user.email || "admin",
        note: data.note ?? "",
      },
    ];

    const patch = { art_history: history, ...actorPatch(context.user) };
    if (data.art_file_uri) patch.art_file_uri = data.art_file_uri;
    if (data.action === "enviada" && order.art_approval_mode === "desativada") {
      patch.art_approval_mode = "opcional";
    }
    if (data.action === "enviada") {
      patch.art_approval_status = "aguardando";
      patch.art_approval_requested = true;
      if (["aguardando_pagamento", "pagamento_aprovado"].includes(order.status)) {
        patch.status = "aguardando_aprovacao";
        patch.status_history = [
          ...(order.status_history ?? []),
          { status: "aguardando_aprovacao", date: new Date().toISOString(), by: context.user.email ?? "admin" },
        ];
      }
    }
    if (data.action === "aprovada") {
      patch.art_approval_status = "aprovada";
      patch.status = "arte_aprovada";
      patch.status_history = [
        ...(order.status_history ?? []),
        { status: "arte_aprovada", date: new Date().toISOString(), by: context.user.email ?? "admin" },
      ];
    }
    if (data.action === "ajustes") {
      patch.art_approval_status = "ajustes";
      patch.status = "ajustes_solicitados";
      patch.status_history = [
        ...(order.status_history ?? []),
        { status: "ajustes_solicitados", date: new Date().toISOString(), by: context.user.email ?? "admin" },
      ];
    }

    const updated = await role.entities.Order.update(data.order_id, patch);
    if (data.action === "enviada") await notifyCustomer(context.getBase44(), updated, "art_ready");
    return updated;
  });

export const purgeOriginals = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ days: z.number().min(1).max(3650) }))
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem executar a retenção.");
    const role = context.getBase44().asServiceRole;
    const cutoff = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const orders = await role.entities.Order.filter(
      { status: { $in: ["enviado", "concluido"] }, created_date: { $lt: cutoff } },
      { limit: 200 }
    );
    const ids = (orders.items ?? []).map((order) => order.id);
    if (!ids.length) return { purged: 0, orders: 0 };

    const photos = await role.entities.OrderPhoto.filter(
      { order_id: { $in: ids }, original_file_uri: { $exists: true } },
      { limit: 500 }
    );
    const targets = (photos.items ?? []).filter((photo) => photo.original_file_uri);
    if (!targets.length) return { purged: 0, orders: ids.length };

    await role.entities.OrderPhoto.bulkUpdate(targets.map((photo) => ({ id: photo.id, original_file_uri: "" })));
    return { purged: targets.length, orders: ids.length };
  });

const PeriodInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// As datas são do fuso da loja (Brasil, UTC-3), não de UTC.
function periodQuery({ from, to }) {
  const start = new Date(`${from}T00:00:00.000-03:00`).toISOString();
  const end = new Date(`${to}T23:59:59.999-03:00`).toISOString();
  if (start > end) throw new Error("A data inicial precisa ser anterior à final.");
  return { created_date: { $gte: start, $lte: end } };
}

export const countPhotosByPeriod = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(PeriodInput)
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem consultar as fotos.");
    const count = await context.getBase44().asServiceRole.entities.OrderPhoto.count(periodQuery(data));
    return { count };
  });

export const purgePhotosByPeriod = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(PeriodInput)
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem apagar fotos.");
    const role = context.getBase44().asServiceRole;
    const query = periodQuery(data);
    const total = await role.entities.OrderPhoto.count(query);
    if (!total) return { deleted: 0 };
    await role.entities.OrderPhoto.deleteMany(query);
    return { deleted: total };
  });

// Endereço da loja vem da própria requisição: nunca do que o navegador informa,
// para que os retornos e os avisos de pagamento não possam ser desviados.
function requestBaseUrl() {
  const request = getRequest();
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  return (process.env.PUBLIC_APP_URL || `${proto}://${host}`).replace(/\/$/, "");
}

export const createPayment = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const token = await getMercadoPagoToken(context.getBase44());
    if (!token) {
      return {
        configured: false,
        message:
          "O pagamento online ainda não está ativo na loja. A Paracolor precisa cadastrar o token do Mercado Pago no painel.",
      };
    }

    const role = context.getBase44().asServiceRole;
    const order = await role.entities.Order.get(data.order_id);
    if (order.created_by_id !== context.user.id && context.user.role !== "admin") {
      throw new Error("Sem permissão para este pedido.");
    }

    if (order.status === "cancelado" || ["aprovado", "reembolsado"].includes(order.payment_status)) throw new Error("Este pedido não pode receber um novo pagamento.");
    if (!(Number(order.total) > 0)) throw new Error("O total do pedido precisa ser conferido pela loja.");
    const base = requestBaseUrl();
    const preference = {
      external_reference: order.id,
      items: [{ title: `Pedido ${order.order_number}`, quantity: 1, unit_price: Number(order.total), currency_id: "BRL" }],
      payer: { name: order.customer_name, email: order.customer_email },
      back_urls: {
        success: `${base}/pedido/${order.id}?pagamento=sucesso`,
        pending: `${base}/pedido/${order.id}?pagamento=pendente`,
        failure: `${base}/pedido/${order.id}?pagamento=falha`,
      },
      notification_url: `${base}/api/mercadopago-webhook`,
      auto_return: "approved",
      statement_descriptor: "PARACOLOR",
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(preference),
    });

    if (!response.ok) {
      return { configured: true, message: "O Mercado Pago recusou a criação do pagamento. Tente novamente." };
    }

    const result = await response.json();
    await role.entities.Order.update(order.id, {
      payment_reference: String(result.id ?? ""),
      payment_url: result.init_point ?? "",
    });

    return { configured: true, init_point: result.init_point, sandbox_init_point: result.sandbox_init_point };
  });

export const createDownloadLink = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      order_id: z.string().min(1),
      only: z.string().max(20).optional(),
      size: z.string().max(30).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const role = context.getBase44().asServiceRole;
    const order = await role.entities.Order.get(data.order_id);
    if (order.created_by_id !== context.user.id && context.user.role !== "admin") {
      throw new Error("Sem permissão para este pedido.");
    }
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await role.entities.Order.update(order.id, { download_token: token, download_token_expires: expires });
    const params = new URLSearchParams({ orderId: order.id, token });
    if (data.only) params.set("only", data.only);
    if (data.size) params.set("size", data.size);
    return { url: `/api/order-zip?${params.toString()}`, expires_at: expires };
  });
