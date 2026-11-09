import { validateOrderUploads } from "./vps/files.server";
import { withTransaction } from "./vps/db.server";
import { makeEntityService } from "./vps/entities.server";
import { computeCheckout } from "@/lib/checkout-pricing.server";
import { notifyCustomer } from "@/lib/email.server";
import { isProfessional, isOnlinePayment, PICKUP_PAYMENT } from "@/lib/order-payment";
import { orderPhotosForItems } from "@/lib/photo-order";
const list = (value) => Array.isArray(value) ? value : value.items;
const resultFor = (order) => ({
  order_id: order.id,
  order_number: order.order_number,
  total: order.total,
  payment_method: order.payment_method,
});

export async function saveCheckoutOrder(base44, user, data, defaults) {
  const { order, created } = await withTransaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [user.id + ":" + data.checkout_key]);
    return writeCheckoutOrder(makeEntityService(user, true, db), user, data, defaults, db);
  });
  if (created) await notifyCustomer(base44, order, "order_created");
  return resultFor(order);
}

async function writeCheckoutOrder(role, user, data, defaults, db) {
  const existing = list(await role.entities.Order.filter({ checkout_key: data.checkout_key, created_by_id: user.id }, { limit: 1 }))[0];
  if (existing) return { order: existing, created: false };
  if (data.fulfillment === "entrega" && (!data.shipping_address?.trim() || !/^\d{8}$/.test((data.shipping_cep || "").replace(/\D/g, "")))) throw new Error("Informe o CEP e o endereço completo para entrega.");
  const quote = await computeCheckout(role, data, defaults, user, db);
  if (data.quoted_total != null && Math.round(data.quoted_total * 100) !== Math.round(quote.total * 100)) {
    throw new Error("O valor do pedido mudou. Confira o total atualizado e confirme novamente.");
  }
  const fileUris = quote.items.flatMap(({ input }) => [
    ...input.photos.flatMap((photo) => [photo.original_file_uri, photo.print_file_uri]),
    input.options.art_file_uri,
    input.options.magnet_print_sheet_uri,
    input.area !== "moldura" ? input.preview_uri : "",
  ]).filter(Boolean);
  await validateOrderUploads(fileUris, user.id, db);
  const modes = quote.items.map((item) => item.input.options.art_approval_mode);
  const mandatory = modes.includes("obrigatoria");
  const requested = quote.items.some((item) => item.input.options.art_approval_requested);
  const number = `PEDIDO_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const pickupPayment = data.payment_method === PICKUP_PAYMENT;
  const complimentary = quote.discount > 0 && quote.total === 0;
  const status = complimentary ? "pagamento_aprovado" : pickupPayment
    ? (requested ? "aguardando_arte" : "aguardando_producao")
    : "aguardando_pagamento";
  const pricingTable = quote.items.some((item) => item.input.options.pricing_table === "profissional") ? "profissional" : "normal";
  const order = await role.entities.Order.create({
    created_by_id: user.id,
    checkout_key: data.checkout_key, order_number: number, customer_name: data.customer_name.trim(), customer_email: data.customer_email,
    ...(data.fulfillment === "retirada" ? { pickup_qr_token: `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}` } : {}),
    customer_phone: data.customer_phone, customer_cpf: data.customer_cpf || "", customer_user_id: user.id,
    customer_professional: isProfessional(user), pricing_table: pricingTable,
    fulfillment: data.fulfillment, shipping_cep: data.shipping_cep || "", shipping_address: data.shipping_address || "",
    shipping_service: data.shipping_service || "", shipping_label: quote.shipping_label || "",
    subtotal: quote.subtotal, discount: quote.discount, shipping_cost: quote.shipping_cost, total: quote.total, coupon_code: quote.coupon_code,
    ...(quote.coupon_id ? { coupon_id: quote.coupon_id, discount_label: quote.discount_label } : {}),
    ...(quote.coupon_limited && !complimentary && isOnlinePayment(data.payment_method)
      ? { coupon_pay_by: new Date(Date.now() + 72 * 3_600_000).toISOString() } : {}),
    gift_message: data.gift_message || "", payment_method: data.payment_method, payment_status: complimentary ? "aprovado" : "pendente", status,
    ...(data.infinitepay_card_only ? { infinitepay_card_only: true } : {}),
    ...(complimentary ? { payment_approved_at: new Date().toISOString() } : {}),
    status_history: [{
      status, date: new Date().toISOString(), by: user.email || "cliente",
      ...(complimentary ? { note: "Valor integral coberto pelo desconto." } : pickupPayment ? { note: "Pagamento combinado para a retirada na loja." } : {}),
    }],
    art_approval_mode: mandatory ? "obrigatoria" : modes.includes("opcional") ? "opcional" : "desativada",
    art_approval_requested: requested, art_approval_status: requested ? "aguardando" : "nao_requerida", art_history: [],
    production_days: Math.max(1, ...quote.items.map((item) => Number(item.production_days) || 0)), internal_notes: "",
    production_deadline_label: [...new Set(quote.items.map((item) => item.production_label).filter(Boolean))].join(" · "),
  });
  const created = list(await role.entities.OrderItem.bulkCreate(quote.items.map((item) => ({
    created_by_id: user.id,
    order_id: order.id, area: item.input.area, product_ref_id: item.input.ref_id, product_name: item.product_name,
    variant: item.variant, qty: item.qty, unit_price: item.unit_price, line_total: item.line_total,
    photo_count: item.input.photos?.length || 0, options: { ...item.input.options, preview_uri: item.input.preview_uri || "" },
  }))));
  if (created.length !== quote.items.length) throw new Error("Não foi possível salvar todos os itens.");
  const photos = orderPhotosForItems(quote.items.map((item) => item.input)).map(
    ({ photo: { position: _position, ...photo }, itemIndex }, sort) => ({
      ...photo, created_by_id: user.id, order_id: order.id, item_id: created[itemIndex].id,
      area: quote.items[itemIndex].input.area, copies: photo.copies || 1, sort,
    }),
  );
  if (photos.length) {
    const saved = list(await role.entities.OrderPhoto.bulkCreate(photos));
    if (saved.length !== photos.length) throw new Error("Não foi possível salvar todas as fotos.");
  }
  if (isProfessional(user) || complimentary) await role.entities.Order.update(order.id, { checkout_completed: true });
  await db.query(
    `UPDATE vps_records SET data=data || $2::jsonb,updated_at=now()
     WHERE entity='CartLead' AND data->>'user_id'=$1 AND data->>'status' IN ('aberto','lembrete_enviado')`,
    [user.id, { status: "recuperado", recovered_order: order.order_number }],
  );
  return { order, created: true };
}
