import { needsArtApproval } from "@/lib/order-production";
import { orderStatusAfterArtApproval } from "@/lib/order-art-status";
import { canAccessOrder, createOrderDownload } from "@/lib/order-download.server";
import { applyOriginalRetention, photosByPeriod, previewOriginalRetention } from "@/lib/file-retention.server";
import { activePaymentMethods } from "./payment-provider-config.server";
import { openProviderPayment, refreshProviderPayment } from "./payment-attempts.server";
import { isNewOnlinePayment } from "./payment-providers";
import { paymentTokenHash } from "./coupon-payment.server";
import { checkCouponPaymentDeadline, lockCampaigns } from "./coupons.server";
import { withTransaction } from "./vps/db.server";
import { makeEntityService } from "./vps/entities.server";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { OrderInput, QuoteInput } from "@/lib/checkout-validation";
import { computeCheckout } from "@/lib/checkout-pricing.server";
import { saveCheckoutOrder } from "@/lib/checkout-orders.server";
import { getMelhorEnvioConfig, getMercadoPagoToken } from "@/lib/integrations.server";
import { enqueueOrderNotice, sendPendingOrderNotices } from "@/lib/order-notices.server";
import { consultMercadoPago } from "@/lib/mercadopago-reconcile.server";
import { notifyCustomer } from "@/lib/email.server";
import { canUpdateOrderAsStaff, hasStaffAccess } from "@/lib/staff-access";
import {
  canProduceOrder, checkoutPaymentMethods, isPickupPaymentOrder, isOnlinePayment, ONLINE_PAYMENT, paymentRouting,
} from "@/lib/order-payment";

const DEFAULT_SETTINGS = {
  store_name: "Paracolor",
  google_review_url: "",
  production_days: 3,
  auto_backup_enabled: true,
  auto_backup_time: "03:00",
  auto_backup_retention: 7,
  cutoff_hour: 17,
  holidays: [],
  retention_days: 90,
  retention_auto: true,
  maintenance_enabled: false,
  allow_store_payment: true,
  shipping_enabled: false,
  shipping_flat: 0,
  pickup_info: "Retirada na loja, avisamos por e-mail e WhatsApp quando o pedido estiver pronto.",
  wa_template_arte:
    "Olá! Aqui é a Paracolor. Segue a arte do pedido {pedido} para você conferir e aprovar. Responda esta mensagem dizendo se está tudo certo ou o que precisa ajustar.",
  wa_template_contato: "Olá! Vim pelo site da Paracolor e gostaria de falar sobre {pedido}.",
  module_revelacao: true,
  module_polaroids: true,
  module_fotos_ima: true,
  module_banners: true,
  module_personalizados: true,
  module_molduras: true,
  module_albuns_books: true,
  module_molduras_online: false,
  module_aprovacao_whatsapp: true,
  module_destaques: true,
  module_promocoes: true,
  module_photo_duplicate_organizer: true,
  module_polaroid_batch_mounter: false,
  pickup_qr_behavior: "automatico",
  page_home: true,
  page_revelar: true,
  page_polaroids_criar: true,
  page_banner_pedido: true,
  page_personalizado_produto: true,
  page_album_book_produto: true,
  page_carrinho: true,
  page_checkout: true,
  page_minha_conta: true,
  page_pedido: true,
  page_consultar_pedido: true,
  page_simulador: true,
  page_contato: true,
  page_privacidade: true,
  page_termos: true,
  page_trocas: true,
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
    allow_store_payment: settings.allow_store_payment !== false,
    online_payment_enabled: Boolean(await getMercadoPagoToken(base44)),
    shipping_quote_enabled: Boolean(shipping?.enabled),
  };
});

export const quoteCheckout = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(QuoteInput)
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const [quote, token, providers] = await Promise.all([
      computeCheckout(base44.asServiceRole, data, DEFAULT_SETTINGS, context.user),
      getMercadoPagoToken(base44),
      activePaymentMethods(),
    ]);
    const payment_methods = checkoutPaymentMethods({
      user: context.user, fulfillment: data.fulfillment, settings: quote.settings, onlineEnabled: Boolean(token), providers,
    });
    return {
      subtotal: quote.subtotal, discount: quote.discount, shipping_cost: quote.shipping_cost,
      shipping_label: quote.shipping_label, total: quote.total, coupon_code: quote.coupon_code, discount_label: quote.discount_label, payment_methods, routed_payment: paymentRouting(quote.settings).enabled,
      items: quote.items.map(({ input, product_name, unit_price, line_total, qty }) => ({
        product_name, unit_price, line_total, qty,
        pricing_table: input.options.pricing_table,
        tier_label: input.options.tier_label,
        tier_quantity: input.options.tier_quantity,
      })),
    };
  });

export const quoteCartCampaign = createServerFn({ method: "POST" })
  .validator(QuoteInput)
  .handler(async ({ data, context }) => {
    const quote = await computeCheckout(context.getBase44().asServiceRole, data, DEFAULT_SETTINGS, context.user);
    return { subtotal: quote.subtotal, discount: quote.discount, label: quote.discount_label };
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(OrderInput)
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const store = asArray(
      await base44.asServiceRole.entities.Settings.list({ sort: "-created_date", limit: 1 })
    )[0];
    if (store?.maintenance_enabled) throw new Error("A loja está em manutenção e novos pedidos estão pausados.");
    const onlineEnabled = data.payment_method === ONLINE_PAYMENT && Boolean(await getMercadoPagoToken(base44));
    const providers = isNewOnlinePayment(data.payment_method) ? await activePaymentMethods() : [];
    const methods = checkoutPaymentMethods({ user: context.user, fulfillment: data.fulfillment, settings: store, onlineEnabled, providers });
    if (!methods.includes(data.payment_method)) {
      throw new Error(isOnlinePayment(data.payment_method)
        ? "O pagamento online está indisponível. Confira as opções de pagamento do pedido."
        : "Esta forma de pagamento não está disponível para sua conta e forma de recebimento.");
    }
    return saveCheckoutOrder(base44, context.user, {
      ...data, infinitepay_card_only: data.payment_method === "infinitepay" && paymentRouting(store).enabled,
    }, DEFAULT_SETTINGS);
  });

async function lockOrderForUpdate(db, orderId) {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 1))", [orderId]);
}

function statusEntry(user, status, note) {
  return { status, date: new Date().toISOString(), by: user.full_name || user.email || "admin", note };
}

function requireReadyForDelivery(order, status) {
  if (order.payment_status !== "aprovado") throw new Error("Confirme o recebimento antes de dar baixa no pedido.");
  if (needsArtApproval(order)) {
    throw new Error("A arte precisa ser aprovada antes de dar baixa.");
  }
  if (status === "enviado" && (order.fulfillment !== "entrega" || order.status !== "pronto")) {
    throw new Error("Marque o pedido para entrega como pronto antes de registrar o envio.");
  }
  if (status === "retirado" && (order.fulfillment !== "retirada" || order.status !== "pronto")) {
    throw new Error("Marque o pedido para retirada como pronto antes de registrar a baixa.");
  }
  if (status === "concluido" && (order.fulfillment !== "entrega" || order.status !== "enviado")) {
    throw new Error("Registre o envio antes de confirmar a entrega.");
  }
}

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({
    order_id: z.string().min(1),
    status: z.enum(["aguardando_pagamento", "pagamento_aprovado", "aguardando_arte", "aguardando_aprovacao", "ajustes_solicitados", "arte_aprovada", "aguardando_producao", "em_producao", "aguardando_conferencia", "pronto", "retirado", "enviado", "concluido", "cancelado"]),
    note: z.string().max(400).optional(),
  }))
  .handler(async ({ data, context }) => {
    if (!canUpdateOrderAsStaff(context.user, data.status)) throw new Error("Seu nível de acesso não permite alterar este status.");
    const { status } = data;
    const confirmingPayment = status === "pagamento_aprovado";
    const result = await withTransaction(async (db) => {
      if (confirmingPayment) await lockCampaigns(db);
      await lockOrderForUpdate(db, data.order_id);
      const orders = makeEntityService(context.user, true, db).entities.Order;
      const order = await orders.get(data.order_id);
      if (confirmingPayment && isOnlinePayment(order.payment_method)) {
        throw new Error("Consulte a confirmação do provedor na área de pagamentos.");
      }
      if (confirmingPayment && (order.status === "cancelado" || order.payment_status === "reembolsado")) {
        throw new Error("Este pedido não pode receber confirmação de pagamento.");
      }
      if (confirmingPayment ? order.payment_status === "aprovado" : order.status === status) return order;
      if (["retirado", "concluido", "cancelado"].includes(order.status)) throw new Error("Este pedido já foi encerrado.");
      const production = ["aguardando_producao", "em_producao", "aguardando_conferencia", "pronto"].includes(status);
      if (production && !canProduceOrder(order)) throw new Error("Confirme o pagamento antes de liberar a produção.");
      if (production && needsArtApproval(order)) {
        throw new Error("Este pedido precisa da aprovação da arte antes da produção.");
      }
      if (["enviado", "retirado", "concluido"].includes(status)) requireReadyForDelivery(order, status);
      if (confirmingPayment && order.coupon_pay_by) checkCouponPaymentDeadline(order);
      const preserveStatus = confirmingPayment && isPickupPaymentOrder(order);
      const date = new Date().toISOString();
      const updated = await orders.update(order.id, {
        ...(preserveStatus ? {} : { status }),
        ...(confirmingPayment ? { payment_status: "aprovado", payment_approved_at: date } : {}),
        status_history: [...(order.status_history ?? []), statusEntry(context.user, status,
          data.note || (preserveStatus ? "Recebimento no balcão confirmado." : ""))],
        ...actorPatch(context.user, date),
      });
      await enqueueOrderNotice(db, order.id, { pagamento_aprovado: "payment_approved", pronto: "order_ready", enviado: "shipped" }[status]);
      return updated;
    });
    void sendPendingOrderNotices(context.getBase44()).catch(() => {});
    return result;
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
    if (!hasStaffAccess(context.user, "production")) throw new Error("Apenas produção, gerência e administração podem liberar pedidos para produção.");
    return withTransaction(async (db) => {
      await lockOrderForUpdate(db, data.order_id);
      const role = makeEntityService(context.user, true, db);
      const order = await role.entities.Order.get(data.order_id);
      if (["pronto", "enviado", "concluido", "cancelado"].includes(order.status)) {
        throw new Error("O pedido já saiu da produção.");
      }
      if (!canProduceOrder(order)) throw new Error("Confirme o pagamento antes de liberar a produção.");
      if (needsArtApproval(order)) {
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
    if (!hasStaffAccess(context.user, "production")) throw new Error("Apenas produção, gerência e administração podem alterar prazos.");
    return withTransaction(async (db) => {
      await lockOrderForUpdate(db, data.order_id);
      const role = makeEntityService(context.user, true, db);
      const order = await role.entities.Order.get(data.order_id);
      if (["pronto", "enviado", "concluido", "cancelado"].includes(order.status)) {
        throw new Error("O pedido já saiu da produção.");
      }

      if (!data.due_at) {
        return role.entities.Order.update(order.id, { quick_due_at: "", quick_label: "", ...actorPatch(context.user) });
      }

      if (!canProduceOrder(order)) throw new Error("Confirme o pagamento antes de definir o prazo.");
      if (needsArtApproval(order)) {
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
  });

// Encerrar o prazo destaca o atraso. Somente a equipe confirma que a produção terminou.
export const releaseOrderByNumber = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ number: z.string().trim().min(1).max(40) }))
  .handler(async ({ data, context }) => {
    if (!hasStaffAccess(context.user, "deliveries")) throw new Error("Apenas gerência e administração podem confirmar a retirada do pedido.");
    return withTransaction(async (db) => {
      const { rows } = await db.query(
        `SELECT id FROM vps_records WHERE entity='Order'
         AND (lower(data->>'order_number')=lower($1) OR lower(data->>'internal_number')=lower($1))
         LIMIT 2`, [data.number],
      );
      if (!rows.length) throw new Error(`Nenhum pedido encontrado com o número ${data.number}.`);
      if (rows.length > 1) throw new Error("Esse número identifica mais de um pedido. Abra o pedido correto para confirmar a baixa.");
      const id = rows[0].id;
      await lockOrderForUpdate(db, id);
      const orders = makeEntityService(context.user, true, db).entities.Order;
      const order = await orders.get(id);
      const destination = order.fulfillment === "entrega" ? "concluido" : "retirado";
      if (["retirado", "concluido"].includes(order.status)) throw new Error("Esse pedido já teve baixa.");
      requireReadyForDelivery(order, destination);
      const label = order.internal_number || order.order_number;
      await orders.update(id, {
        status: destination,
        status_history: [...(order.status_history ?? []), statusEntry(context.user, destination,
          order.fulfillment === "entrega" ? "Entrega confirmada." : "Retirada na loja confirmada.")],
        ...actorPatch(context.user),
      });
      return { label, customer_name: order.customer_name, fulfillment: order.fulfillment };
    });
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
    if (!hasStaffAccess(context.user, "art")) throw new Error("Seu nível de acesso não permite registrar ações de arte.");
    const result = await withTransaction(async (db) => {
      await lockOrderForUpdate(db, data.order_id);
      const orders = makeEntityService(context.user, true, db).entities.Order;
      const order = await orders.get(data.order_id);
      const date = new Date().toISOString();
      const status = data.action === "aprovada" ? orderStatusAfterArtApproval(order) : order.status;
      const artStatus = { enviada: "aguardando", aprovada: "aprovada", ajustes: "ajustes" }[data.action];
      if (data.action === "aprovada" && order.art_approval_status === artStatus && order.status === status
        && !data.note && (!data.art_file_uri || data.art_file_uri === order.art_file_uri)) return order;
      const entry = { date, action: data.action, by: context.user.full_name || context.user.email || "admin", note: data.note ?? "" };
      const patch = {
        art_history: [...(Array.isArray(order.art_history) ? order.art_history : []), entry],
        art_approval_status: artStatus,
        art_approval_requested: true,
        ...(order.art_approval_mode === "desativada" ? { art_approval_mode: "opcional" } : {}),
        ...(data.art_file_uri ? { art_file_uri: data.art_file_uri } : {}),
        ...(status !== order.status ? {
          status,
          status_history: [...(Array.isArray(order.status_history) ? order.status_history : []),
            { status, date, by: entry.by, note: "Aprovação de arte registrada." }],
        } : {}),
        ...actorPatch(context.user, date),
      };
      return orders.update(order.id, patch);
    });
    if (data.action === "enviada") await notifyCustomer(context.getBase44(), result, "art_ready");
    return result;
  });

export const getOriginalRetentionPreview = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(({ context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem consultar a retenção.");
    return previewOriginalRetention();
  });

export const purgeOriginals = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({
    days: z.number().int().min(1).max(3650),
    cutoff: z.iso.datetime({ precision: 3 }),
    signature: z.string().regex(/^[a-f0-9]{64}$/),
  }))
  .handler(({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem executar a retenção.");
    return applyOriginalRetention(data);
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
  return { start, end };
}

export const countPhotosByPeriod = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(PeriodInput)
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem consultar as fotos.");
    const { start, end } = periodQuery(data);
    return photosByPeriod(start, end);
  });

export const purgePhotosByPeriod = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(PeriodInput.extend({ confirmation: z.literal("APAGAR"), expectedCount: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem apagar fotos.");
    const { start, end } = periodQuery(data);
    return photosByPeriod(start, end, data.expectedCount);
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
    const role = context.getBase44().asServiceRole;
    const order = await role.entities.Order.get(data.order_id);
    if (isNewOnlinePayment(order.payment_method)) return openProviderPayment(context.user, order.id);
    const token = await getMercadoPagoToken(context.getBase44());
    if (!token) {
      return {
        configured: false,
        message:
          "O pagamento online ainda não está ativo na loja. A Paracolor precisa cadastrar o token do Mercado Pago no painel.",
      };
    }

    if (order.created_by_id !== context.user.id && context.user.role !== "admin") {
      throw new Error("Sem permissão para este pedido.");
    }

    if (isPickupPaymentOrder(order)) throw new Error("O pagamento deste pedido foi combinado para a retirada na loja.");
    if (order.status === "cancelado" || ["aprovado", "reembolsado"].includes(order.payment_status)) throw new Error("Este pedido não pode receber um novo pagamento.");
    if (!(Number(order.total) > 0)) throw new Error("O total do pedido precisa ser conferido pela loja.");
    if (order.coupon_pay_by) {
      await withTransaction(async (db) => {
        await lockCampaigns(db);
        const orders = makeEntityService(context.user, true, db).entities.Order;
        const current = await orders.get(order.id);
        if (current.status === "cancelado" || ["aprovado", "reembolsado"].includes(current.payment_status)) {
          throw new Error("Este pedido não pode receber um novo pagamento.");
        }
        checkCouponPaymentDeadline(current, true);
        if (!current.coupon_payment_started) {
          await orders.update(order.id, { coupon_payment_started: true, coupon_token_hash: paymentTokenHash(token) });
        }
      });
    }
    const base = requestBaseUrl();
    const preference = {
      ...(order.coupon_pay_by ? {
        expires: true, expiration_date_from: new Date().toISOString(),
        expiration_date_to: order.coupon_pay_by, date_of_expiration: order.coupon_pay_by,
      } : {}),
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

export const checkProviderPayment = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({
    order_id: z.string().min(1).max(120),
    transaction: z.string().max(150).optional(), slug: z.string().max(200).optional(), ref: z.string().max(120).optional(),
  }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const order = await base44.asServiceRole.entities.Order.get(data.order_id);
    if (order.created_by_id !== context.user.id && !hasStaffAccess(context.user, "payments")) throw new Error("Sem permissão para este pedido.");
    if (order.payment_method === ONLINE_PAYMENT) return consultMercadoPago(base44, order);
    if (!isNewOnlinePayment(order.payment_method)) throw new Error("Provedor indisponível para este pedido.");
    // Somente a InfinitePay devolve a referência da transação para o cliente.
    const details = order.payment_method === "infinitepay" ? data : {};
    return refreshProviderPayment(base44, order, details);
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
    if (!canAccessOrder(context.user, order)) throw new Error("Sem permissão para este pedido.");
    return createOrderDownload(context.user, order, data.only || "all", data.size || "");
  });
