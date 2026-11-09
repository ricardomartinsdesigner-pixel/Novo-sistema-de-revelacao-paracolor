import { getPool, ensureDatabase } from "./vps/db.server.js";
import { NEW_PAYMENT_METHODS, PAYMENT_PROVIDERS, SICOOB_ENDPOINTS } from "./payment-providers.js";
import { openSecret, privateToken, sealSecret, securityKeyConfigured } from "./security-secrets.server.js";
import { X509Certificate, createPrivateKey } from "node:crypto";

const secretContext = (id) => "payment-provider:" + id;
export const paymentsSandbox = () => process.env.PAYMENTS_SANDBOX_MODE === "true";


function defaultConfig(id) {
  return {
    id, enabled: false, priority: PAYMENT_PROVIDERS[id].priority,
    mode: id === "infinitepay" ? "producao" : "teste",
  };
}

export function expectedPaymentMode(config) {
  return config.mode === (paymentsSandbox() ? "teste" : "producao");
}

export async function readPaymentProviders(db) {
  await ensureDatabase();
  const { rows } = await (db ?? getPool()).query("SELECT id, data FROM vps_records WHERE entity='PaymentProviderConfig'");
  const stored = new Map(rows.map((row) => [row.id, row.data]));
  return NEW_PAYMENT_METHODS.map((id) => ({ ...defaultConfig(id), ...stored.get(id), id }));
}

export function providerCredentials(config) {
  return config.secret ? openSecret(config.secret, secretContext(config.id)) : {};
}

export async function activePaymentMethods() {
  if (!securityKeyConfigured()) return [];
  return (await readPaymentProviders()).filter((row) => row.enabled && row.tested === true && expectedPaymentMode(row))
    .sort((a, b) => a.priority - b.priority).map((row) => row.id);
}

export function publicPaymentBase() {
  try {
    const url = new URL(process.env.PUBLIC_APP_URL);
    if (url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/") return url.origin;
  } catch { /* report the required configuration below */ }
  throw new Error("Configure PUBLIC_APP_URL com o endereço HTTPS da loja.");
}

export function paymentWebhookUrl(id, orderId = "") {
  const base = publicPaymentBase();
  const key = privateToken(`payment-hook:${id}:${orderId}`);
  return `${base}/api/confirmacao-pagamento/${id}?chave=${key}${orderId ? "&pedido=" + encodeURIComponent(orderId) : ""}`;
}

export function validateProviderCredentials(config, data) {
  if (config.id === "infinitepay") {
    if (config.mode !== "producao" || !/^inchk_[A-Za-z0-9_-]+$/.test(data.apiKey || "") || !/^[A-Za-z0-9_.-]+$/.test(data.handle || "")) {
      throw new Error("Informe a API Key do Checkout Integrado e a InfiniteTag (sem cifrão).");
    }
    return;
  }
  if (config.id === "pagarme") {
    const prefix = config.mode === "teste" ? "sk_test_" : "sk_";
    if (!data.apiKey?.startsWith(prefix) || (config.mode === "producao" && data.apiKey.startsWith("sk_test_"))) {
      throw new Error("Informe a chave secreta Pagar.me do ambiente selecionado.");
    }
    return;
  }
  if (!data.clientId || !data.pixKey || !data.certificate || !data.privateKey) {
    throw new Error("Informe o Client ID, a chave Pix, o certificado PEM e a chave privada PEM.");
  }
  if (!SICOOB_ENDPOINTS.token[config.mode].includes(data.tokenUrl) || !SICOOB_ENDPOINTS.api[config.mode].includes(data.apiUrl)) {
    throw new Error("Selecione os endereços oficiais do Sicoob para o ambiente escolhido.");
  }
  try {
    const certificate = new X509Certificate(data.certificate);
    if (!certificate.checkPrivateKey(createPrivateKey({ key: data.privateKey, passphrase: data.passphrase || undefined }))) throw new Error();
    if (Date.parse(certificate.validTo) <= Date.now() || Date.parse(certificate.validFrom) > Date.now()) throw new Error();
  } catch { throw new Error("Confira a validade e a correspondência do certificado e da chave privada PEM."); }
}

export function prepareProviderConfig(previous, input) {
  const { enabled, priority, mode } = input;
  const credentials = previous.mode === mode ? providerCredentials(previous) : {};
  const supplied = Object.fromEntries(Object.entries(input.credentials ?? {}).filter(([, value]) => value));
  const next = { ...previous, enabled, priority, mode };
  const changed = previous.mode !== mode || Object.entries(supplied).some(([key, value]) => credentials[key] !== value);
  const merged = { ...credentials, ...supplied };
  if (Object.keys(merged).length) {
    validateProviderCredentials(next, merged);
    next.secret = changed || !previous.secret ? sealSecret(merged, secretContext(next.id)) : previous.secret;
  } else {
    next.secret = "";
  }
  if (changed || !next.secret) next.tested = false;
  if (enabled && (!next.secret || !expectedPaymentMode(next))) throw new Error("Configure as credenciais do ambiente em uso antes de ativar.");
  if (enabled && !next.tested) throw new Error("Salve com a integração desativada e teste a conexão antes de ativar.");
  if (enabled) publicPaymentBase();
  return next;
}
