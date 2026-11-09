import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function securityKeyConfigured() {
  return /^[a-f\d]{64}$/i.test(process.env.SECURITY_SECRETS_KEY || "");
}

function key() {
  if (!securityKeyConfigured()) throw new Error("Configure SECURITY_SECRETS_KEY no servidor.");
  return Buffer.from(process.env.SECURITY_SECRETS_KEY, "hex");
}

export function sealSecret(value, context) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

export function openSecret(value, context) {
  const [iv, tag, body] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString());
}

export const privateToken = (context) => createHmac("sha256", key()).update(context).digest("hex");

export function sameToken(value, expected) {
  if (typeof value !== "string" || value.length !== expected.length) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
