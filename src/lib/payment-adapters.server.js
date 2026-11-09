import https from "node:https";
import { providerCredentials } from "./payment-provider-config.server.js";

const INFINITE = "https://api.checkout.infinitepay.io";
const STONE = "https://api.pagar.me/core/v5";
export const onlineCents = (amount) => Math.round(Number(amount) * 100);

class ProviderError extends Error {
  constructor(status = 0) {
    super("O provedor não confirmou a operação.");
    this.status = status;
  }
}

async function jsonRequest(url, { headers, method = "GET", body } = {}) {
  const response = await fetch(url, {
    method, headers: { accept: "application/json", ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error", signal: AbortSignal.timeout(8500),
  });
  if (!response.ok) throw new ProviderError(response.status);
  return response.json();
}

function sicoobRequest(url, credentials, { method = "GET", headers, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === "string" ? body : body ? JSON.stringify(body) : undefined;
    const request = https.request(url, {
      method, cert: credentials.certificate, key: credentials.privateKey,
      passphrase: credentials.passphrase || undefined, minVersion: "TLSv1.2",
      headers: { accept: "application/json", ...headers, ...(payload ? { "content-length": Buffer.byteLength(payload) } : {}) },
      signal: AbortSignal.timeout(8500),
    }, (response) => {
      const chunks = [];
      let total = 0;
      response.on("error", reject);
      response.on("data", (chunk) => {
        total += chunk.length;
        if (total > 512 * 1024) request.destroy(new ProviderError());
        else chunks.push(chunk);
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) { reject(new ProviderError(response.statusCode)); return; }
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch { reject(new ProviderError()); }
      });
    });
    request.on("error", reject);
    request.end(payload);
  });
}

async function sicoobToken(credentials, scope) {
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: credentials.clientId, scope });
  if (credentials.clientSecret) body.set("client_secret", credentials.clientSecret);
  const result = await sicoobRequest(credentials.tokenUrl, credentials, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: body.toString(),
  });
  if (!result.access_token) throw new ProviderError();
  return { authorization: "Bearer " + result.access_token, client_id: credentials.clientId, "content-type": "application/json" };
}

const stoneHeaders = (credentials) => ({ authorization: "Basic " + Buffer.from(credentials.apiKey + ":").toString("base64") });
const infiniteHeaders = (credentials) => ({ "x-api-key": credentials.apiKey });

function trustedCheckout(value, domains) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.port && !url.username && !url.password &&
        domains.some((domain) => url.hostname === domain || url.hostname.endsWith("." + domain))) return url;
  } catch { /* reject missing or invalid checkout URL */ }
  throw new ProviderError();
}

export async function testProvider(config) {
  const credentials = providerCredentials(config);
  if (config.id === "sicoob_pix") {
    await sicoobToken(credentials, "cob.read cob.write");
    return "O Sicoob aceitou o certificado e os escopos de cobrança.";
  }
  if (config.id === "pagarme") {
    await jsonRequest(STONE + "/orders?size=1", { headers: stoneHeaders(credentials) });
    return "Chave aceita pela API do Pagar.me.";
  }
  return "Formato da API Key e da InfiniteTag validado. A autenticação remota é confirmada na primeira cobrança.";
}

export async function createProviderCharge(config, attempt, order, { base, webhook }) {
  const credentials = providerCredentials(config);
  const description = "Pedido " + order.order_number;
  const { ref, amount, expiresAt } = attempt;
  if (config.id === "sicoob_pix") {
    const headers = await sicoobToken(credentials, "cob.write");
    const expires = Math.max(1, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
    const cob = await sicoobRequest(credentials.apiUrl + "/cob/" + ref, credentials, {
      method: "PUT", headers, body: {
        calendario: { expiracao: expires }, chave: credentials.pixKey,
        valor: { original: (amount / 100).toFixed(2), modalidadeAlteracao: 0 }, solicitacaoPagador: description,
      },
    });
    if (cob.txid !== ref || !cob.pixCopiaECola || onlineCents(cob.valor?.original) !== amount) throw new ProviderError();
    return { code: cob.pixCopiaECola };
  }
  if (config.id === "infinitepay") {
    const result = await jsonRequest(INFINITE + "/links", {
      method: "POST", headers: infiniteHeaders(credentials), body: {
        order_nsu: ref,
        redirect_url: `${base}/pedido/${encodeURIComponent(order.id)}?pagamento=pendente`,
        items: [{ quantity: 1, price: amount, description }],
        options: { single_payment: true, valid_until: expiresAt, payment_methods_enabled: order.infinitepay_card_only ? ["credit_card"] : ["credit_card", "pix"] },
        webhook: { url: webhook, events: ["paid", "settled", "refunded", "canceled", "payment_failed"] },
      },
    });
    const url = trustedCheckout(result.url, ["infinitepay.io"]);
    const slug = result.slug || url.pathname.split("/").filter(Boolean).at(-1);
    if (!slug) throw new ProviderError();
    return { url: url.href, remoteId: slug };
  }
  const result = await jsonRequest(STONE + "/paymentlinks", {
    method: "POST", headers: { ...stoneHeaders(credentials), "idempotency-key": ref },
    body: {
      is_building: false, type: "order", name: description, max_paid_sessions: 1, expires_at: expiresAt,
      payment_settings: { accepted_payment_methods: ["credit_card"], credit_card_settings: {
        operation_type: "auth_and_capture", installments: [{ number: 1, total: amount }],
      } },
      cart_settings: { items: [{ name: description + " [" + ref + "]", amount, default_quantity: 1 }] },
    },
  });
  if (!/^pl_[A-Za-z0-9]+$/.test(result.id || "")) throw new ProviderError();
  return { url: trustedCheckout(result.url, ["pagar.me"]).href, remoteId: result.id };
}

function sicoobPayment(cob, attempt) {
  if (cob.txid !== attempt.ref || onlineCents(cob.valor?.original) !== attempt.amount) return null;
  const pix = cob.pix?.find((entry) => entry.txid === attempt.ref && onlineCents(entry.valor) === attempt.amount && entry.endToEndId);
  if (cob.status === "CONCLUIDA" && pix) {
    const refunded = (pix.devolucoes ?? []).filter((row) => row.status === "DEVOLVIDO")
      .reduce((sum, row) => sum + onlineCents(row.valor), 0);
    return { state: refunded >= attempt.amount ? "reembolsado" : "aprovado", transaction: pix.endToEndId };
  }
  if (["REMOVIDA_PELO_USUARIO_RECEBEDOR", "REMOVIDA_PELO_PSP"].includes(cob.status)) return { state: "recusado" };
  const remoteExpiry = Date.parse(cob.calendario?.criacao) + Number(cob.calendario?.expiracao) * 1000;
  if (cob.status === "ATIVA" && !cob.pix?.length && Date.now() >= remoteExpiry + 86_400_000) return { state: "recusado" };
  return null;
}

export function stonePaymentMatches(remote, attempt) {
  if (remote.currency !== "BRL" || Number(remote.amount) !== attempt.amount) return false;
  const linkId = remote.payment_link_id || remote.payment_link?.id;
  if (linkId && attempt.remoteId) return linkId === attempt.remoteId;
  return remote.items?.length === 1 && remote.items[0].description?.endsWith(" [" + attempt.ref + "]")
    && Number(remote.items[0].amount) === attempt.amount && Number(remote.items[0].quantity) === 1;
}

export async function verifyProviderCharge(config, attempt, details = {}) {
  const credentials = providerCredentials(config);
  if (config.id === "sicoob_pix") {
    const headers = await sicoobToken(credentials, "cob.read");
    const cob = await sicoobRequest(credentials.apiUrl + "/cob/" + attempt.ref, credentials, { headers });
    const payment = sicoobPayment(cob, attempt);
    return payment || (cob.status === "ATIVA" && cob.txid === attempt.ref && onlineCents(cob.valor?.original) === attempt.amount
      && cob.pixCopiaECola ? { state: "pendente", code: cob.pixCopiaECola } : null);
  }
  const transaction = details.transaction || attempt.transaction;
  if (!transaction || !/^[A-Za-z0-9_-]{5,150}$/.test(transaction)) return null;
  if (config.id === "infinitepay") {
    const slug = details.slug || attempt.remoteId;
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(slug || "") ||
        (attempt.remoteId ? slug !== attempt.remoteId : !details.recoverFromWebhook) ||
        (details.ref && details.ref !== attempt.ref)) return null;
    const result = await jsonRequest(INFINITE + "/payment_check", {
      method: "POST", headers: infiniteHeaders(credentials),
      body: { handle: credentials.handle, order_nsu: attempt.ref, transaction_nsu: transaction, slug },
    });
    if (Number(result.amount) !== attempt.amount || (result.currency && result.currency !== "BRL") ||
        (result.order_nsu && result.order_nsu !== attempt.ref) ||
        (result.transaction_nsu && result.transaction_nsu !== transaction) || (result.slug && result.slug !== slug)) return null;
    if (["refunded", "charged_back"].includes(result.status)) return { state: "reembolsado", transaction };
    if (result.paid === true && Number(result.paid_amount) >= attempt.amount) return { state: "aprovado", transaction };
    if (["canceled", "cancelled", "payment_failed", "expired"].includes(result.status)) return { state: "recusado", transaction };
    return null;
  }
  if (!/^or_/.test(transaction)) return null;
  const order = await jsonRequest(STONE + "/orders/" + transaction, { headers: stoneHeaders(credentials) });
  if (order.id !== transaction || !stonePaymentMatches(order, attempt)) return null;
  const charges = order.charges ?? [];
  if (order.status === "paid" && charges.some((charge) => charge.status === "paid" && Number(charge.paid_amount ?? charge.amount) === attempt.amount)) {
    return { state: "aprovado", transaction };
  }
  const refund = charges.reduce((total, charge) => {
    if (charge.status === "refunded" || charge.last_transaction?.status === "refunded") return total + Number(charge.paid_amount ?? charge.amount);
    return total + (Number(charge.refunded_amount) || 0);
  }, 0);
  if (refund >= attempt.amount) return { state: "reembolsado", transaction };
  if (["failed", "canceled"].includes(order.status)) return { state: "recusado", transaction };
  return null;
}
