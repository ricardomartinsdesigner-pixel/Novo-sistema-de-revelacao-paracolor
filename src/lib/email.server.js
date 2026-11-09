import { sendStoreEmail } from "@/lib/smtp-transport.server";
import { awaitsPickupPayment, isPickupPaymentOrder } from "@/lib/order-payment";

// Todos os avisos transacionais usam exclusivamente o SMTP salvo pelo administrador.
const FLAG_BY_KIND = {
  order_created: "notify_order_created",
  payment_approved: "notify_payment_approved",
  art_ready: "notify_art_ready",
  order_ready: "notify_order_ready",
  shipped: "notify_shipped",
};

const TITLES = {
  order_created: "Recebemos seu pedido",
  payment_approved: "Pagamento confirmado",
  art_ready: "Sua arte está pronta para aprovação",
  order_ready: "Seu pedido está pronto",
  shipped: "Seu pedido saiu para entrega",
};

function asArray(result) {
  if (Array.isArray(result)) return result;
  return result?.items ?? [];
}

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

export async function loadStoreSettings(base44) {
  const rows = asArray(await base44.asServiceRole.entities.Settings.list({ sort: "-created_date", limit: 1 }));
  return rows[0] ?? {};
}

async function loadItems(base44, order) {
  try {
    return asArray(await base44.asServiceRole.entities.OrderItem.filter({ order_id: order.id }, { limit: 50 }));
  } catch {
    return [];
  }
}

function fulfillmentLine(order, settings) {
  if (order.fulfillment === "entrega") {
    const service = order.shipping_label || order.shipping_service || "Entrega";
    return `Entrega: ${service}${order.shipping_address ? ` — ${order.shipping_address}` : ""}`;
  }
  return settings.pickup_info || "Retirada na loja. Avisamos quando o pedido estiver pronto.";
}

function textFor(kind, order, settings) {
  const total = money(order.total);
  const pickup = fulfillmentLine(order, settings);
  switch (kind) {
    case "order_created":
      if (isPickupPaymentOrder(order)) {
        return `Recebemos seu pedido ${order.order_number}. O total de ${total} será pago no balcão quando você retirar. ${pickup}`;
      }
      return `Seu pedido ${order.order_number} foi registrado com sucesso (total ${total}). Assim que o pagamento for confirmado, começamos a preparar tudo. ${pickup}`;
    case "payment_approved":
      if (isPickupPaymentOrder(order)) return `Confirmamos o recebimento de ${total} referente ao pedido ${order.order_number}. Obrigado!`;
      return `O pagamento do pedido ${order.order_number} (${total}) foi aprovado. Já estamos cuidando da sua arte e da produção. ${pickup}`;
    case "art_ready":
      return `Preparamos a arte do pedido ${order.order_number}. Confira no site e aprove para liberarmos a produção.`;
    case "order_ready":
      if (awaitsPickupPayment(order)) return `O pedido ${order.order_number} está pronto. Você paga ${total} no balcão ao retirar. ${pickup}`;
      return `O pedido ${order.order_number} está pronto! ${pickup}`;
    case "shipped":
      if (order.fulfillment === "retirada" && ["retirado", "concluido"].includes(order.status)) return `A retirada do pedido ${order.order_number} foi registrada. Obrigado!`;
      return `O pedido ${order.order_number} saiu para entrega. ${pickup}`;
    default:
      return "";
  }
}

function itemsHtml(items) {
  if (!items.length) return "";
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:6px 0;font-size:13px;color:#3E3733">${esc(item.qty)}x ${esc(item.product_name)}</td>
        <td style="padding:6px 0;font-size:13px;color:#1F1A17;text-align:right;white-space:nowrap">${money(item.line_total)}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" style="margin:0 0 16px;border-collapse:collapse;border-top:1px solid #EDE7DF;border-bottom:1px solid #EDE7DF">${rows}</table>`;
}

export async function notifyCustomer(base44, order, kind, settingsInput) {
  if (!order?.customer_email) return { sent: false, reason: "sem e-mail do cliente" };
  const flag = FLAG_BY_KIND[kind];
  if (!flag) return { sent: false, reason: "evento desconhecido" };

  const settings = settingsInput ?? (await loadStoreSettings(base44));
  if (settings.email_enabled === false) return { sent: false, reason: "envio desativado" };
  if (settings[flag] === false) return { sent: false, reason: "aviso desativado" };

  const storeName = settings.store_name || "Paracolor";
  const title = TITLES[kind];
  const text = textFor(kind, order, settings);
  const items = await loadItems(base44, order);
  const reply = settings.email_reply_to || settings.email || "";
  const footer = [settings.whatsapp ? `WhatsApp: ${settings.whatsapp}` : "", reply ? `Responder para: ${reply}` : ""]
    .filter(Boolean)
    .join(" · ");

  const html = `<div style="font-family:Inter,Arial,sans-serif;background:#FDFCFB;padding:28px">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #EDE7DF;border-radius:14px;padding:26px">
      <p style="margin:0 0 18px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#86756A">${esc(storeName)}</p>
      <h1 style="margin:0 0 12px;font-size:23px;color:#1F1A17">${esc(title)}</h1>
      <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#3E3733">Olá, ${esc(order.customer_name)}.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3E3733">${esc(text)}</p>
      ${itemsHtml(items)}
      <p style="margin:0 0 4px;font-size:13px;color:#86756A">Pedido ${esc(order.order_number)}</p>
      <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:#1F1A17">Total: ${money(order.total)}</p>
      <p style="margin:0;font-size:11px;color:#86756A">${esc(footer)}</p>
    </div>
  </div>`;

  try {
    await sendStoreEmail(base44, settings, {
      to: order.customer_email,
      subject: `${storeName} · ${title} — ${order.order_number}`,
      html,
      text: `Olá, ${order.customer_name}.\n\n${title}\n\n${text}\n\n${
        items.map((item) => `${item.qty}x ${item.product_name} — ${money(item.line_total)}`).join("\n")
      }\n\nPedido ${order.order_number}\nTotal: ${money(order.total)}\n\n${footer}`,
    });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error?.message || "falha no envio" };
  }
}
