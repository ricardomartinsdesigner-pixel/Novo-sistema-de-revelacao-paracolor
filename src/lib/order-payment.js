import { NEW_PAYMENT_METHODS, PAYMENT_PROVIDERS } from "./payment-providers.js";

export const ONLINE_PAYMENT = "mercadopago";
export const STORE_PAYMENT = "retirada";
export const PICKUP_PAYMENT = "pagar_na_retirada";

export const PAYMENT_METHODS = [ONLINE_PAYMENT, STORE_PAYMENT, PICKUP_PAYMENT, ...NEW_PAYMENT_METHODS];
export const isOnlinePayment = (method) => method === ONLINE_PAYMENT || NEW_PAYMENT_METHODS.includes(method);

export const PAYMENT_METHOD_LABELS = {
  ...Object.fromEntries(Object.entries(PAYMENT_PROVIDERS).map(([id, provider]) => [id, provider.label])),
  [ONLINE_PAYMENT]: "Mercado Pago (Pix ou cartão)",
  [STORE_PAYMENT]: "Combinar o pagamento na loja",
  [PICKUP_PAYMENT]: "Pagar na retirada",
};

export function isProfessional(user) {
  return user?.professional_pricing === true;
}

export function checkoutPaymentMethods({ user, fulfillment, settings, onlineEnabled, providers = [] }) {
  const routing = paymentRouting(settings);
  const methods = routing.enabled
    ? [routing.pix, routing.card].filter((id) => id && providers.includes(id))
    : [...providers, ...(onlineEnabled ? [ONLINE_PAYMENT] : [])];
  if (isProfessional(user)) {
    if (user.allow_pickup_payment === true && fulfillment === "retirada") methods.push(PICKUP_PAYMENT);
  } else if (settings?.allow_store_payment !== false) {
    methods.push(STORE_PAYMENT);
  }
  return methods;
}

export function isPickupPaymentOrder(order) {
  return order.customer_professional === true && order.fulfillment === "retirada" && order.payment_method === PICKUP_PAYMENT;
}

export function awaitsPickupPayment(order) {
  return isPickupPaymentOrder(order) && order.payment_status === "pendente"
    && !["cancelado", "retirado", "enviado", "concluido"].includes(order.status);
}

export function canProduceOrder(order) {
  return order.payment_status === "aprovado" || awaitsPickupPayment(order);
}

export const pendingPickupPaymentFilter = {
  payment_status: "pendente",
  customer_professional: true,
  fulfillment: "retirada",
  payment_method: PICKUP_PAYMENT,
};

export const productionPaymentFilter = {
  $or: [
    { payment_status: "aprovado" },
    pendingPickupPaymentFilter,
  ],
};

export function paymentRouting(settings) {
  const routing = settings?.payment_routing;
  return {
    enabled: routing?.enabled === true,
    pix: routing?.pix === "sicoob_pix" ? routing.pix : "",
    card: ["infinitepay", "pagarme"].includes(routing?.card) ? routing.card : "",
  };
}
