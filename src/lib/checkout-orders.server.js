import { computeCheckout } from "@/lib/checkout-pricing.server";
import { notifyCustomer } from "@/lib/email.server";
const list = (value) => Array.isArray(value) ? value : value.items;
const resultFor = (order) => ({ order_id: order.id, order_number: order.order_number, total: order.total });

export async function saveCheckoutOrder(base44, user, data, defaults) {
  const role = base44.asServiceRole;
  const existing = (await base44.entities.Order.filter({ checkout_key: data.checkout_key, created_by_id: user.id }, { limit: 1 })).items[0];
  if (existing) return resultFor(existing);
  if (data.fulfillment === "entrega" && (!data.shipping_address?.trim() || !/^\d{8}$/.test((data.shipping_cep || "").replace(/\D/g, "")))) throw new Error("Informe o CEP e o endereço completo para entrega.");
  const quote = await computeCheckout(role, data, defaults);
  const modes = quote.items.map((item) => item.input.options.art_approval_mode);
  const mandatory = modes.includes("obrigatoria");
  const requested = quote.items.some((item) => item.input.options.art_approval_requested);
  const number = `PEDIDO_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const order = await base44.entities.Order.create({
    checkout_key: data.checkout_key, order_number: number, customer_name: data.customer_name.trim(), customer_email: data.customer_email,
    customer_phone: data.customer_phone, customer_cpf: data.customer_cpf || "", customer_user_id: user.id,
    fulfillment: data.fulfillment, shipping_cep: data.shipping_cep || "", shipping_address: data.shipping_address || "",
    shipping_service: data.shipping_service || "", shipping_label: quote.shipping_label || "",
    subtotal: quote.subtotal, discount: quote.discount, shipping_cost: quote.shipping_cost, total: quote.total, coupon_code: quote.coupon_code,
    gift_message: data.gift_message || "", payment_method: data.payment_method, payment_status: "pendente", status: "aguardando_pagamento",
    status_history: [{ status: "aguardando_pagamento", date: new Date().toISOString(), by: user.email || "cliente" }],
    art_approval_mode: mandatory ? "obrigatoria" : modes.includes("opcional") ? "opcional" : "desativada",
    art_approval_requested: requested, art_approval_status: requested ? "aguardando" : "nao_requerida", art_history: [],
    production_days: Math.max(1, ...quote.items.map((item) => Number(item.production_days) || 0)), internal_notes: "",
    production_deadline_label: [...new Set(quote.items.map((item) => item.production_label).filter(Boolean))].join(" · "),
  });
  try {
    const created = list(await base44.entities.OrderItem.bulkCreate(quote.items.map((item) => ({
      order_id: order.id, area: item.input.area, product_ref_id: item.input.ref_id, product_name: item.product_name,
      variant: item.variant, qty: item.qty, unit_price: item.unit_price, line_total: item.line_total,
      photo_count: item.input.photos?.length || 0, options: { ...item.input.options, preview_uri: item.input.preview_uri || "" },
    }))));
    if (created.length !== quote.items.length) throw new Error("Não foi possível salvar todos os itens.");
    const photos = quote.items.flatMap((item, index) => (item.input.photos || []).map((photo, sort) => ({
      ...photo, order_id: order.id, item_id: created[index].id, area: item.input.area, copies: photo.copies || 1, sort,
    })));
    if (photos.length) {
      const saved = list(await base44.entities.OrderPhoto.bulkCreate(photos));
      if (saved.length !== photos.length) throw new Error("Não foi possível salvar todas as fotos.");
    }
  } catch (error) {
    await role.entities.OrderPhoto.deleteMany({ order_id: order.id });
    await role.entities.OrderItem.deleteMany({ order_id: order.id });
    await role.entities.Order.delete(order.id);
    throw error;
  }
  await notifyCustomer(base44, order, "order_created");
  return resultFor(order);
}
