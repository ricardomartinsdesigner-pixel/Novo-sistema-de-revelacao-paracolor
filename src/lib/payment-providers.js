export const PAYMENT_PROVIDERS = {
  sicoob_pix: { label: "Pix Sicoob", priority: 10, description: "Pague com QR Code ou Pix Copia e Cola neste site." },
  infinitepay: { label: "InfinitePay (Pix ou cartão)", priority: 20, description: "Conclua o pagamento no checkout da InfinitePay." },
  pagarme: { label: "Stone / Pagar.me (cartão)", priority: 30, description: "Conclua o pagamento no checkout da Stone / Pagar.me." },
};

export const NEW_PAYMENT_METHODS = Object.keys(PAYMENT_PROVIDERS);
export const isNewOnlinePayment = (method) => Object.hasOwn(PAYMENT_PROVIDERS, method);

export const SICOOB_ENDPOINTS = {
  token: {
    producao: [
      "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token",
      "https://apis.sisbr.com.br/cooperado/pix/token",
    ],
    teste: [
      "https://sandbox.sicoob.com.br/sicoob/sandbox/token",
      "https://api-homol.sicoob.com.br/cooperado/pix/token",
    ],
  },
  api: {
    producao: ["https://api.sicoob.com.br/pix/api/v2", "https://apis.sisbr.com.br/cooperado/pix/api/v2"],
    teste: ["https://sandbox.sicoob.com.br/sicoob/sandbox/pix/api/v2", "https://api-homol.sicoob.com.br/cooperado/pix/api/v2"],
  },
};
