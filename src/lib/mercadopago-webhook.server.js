import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMercadoPagoSignature({ secret, signature, requestId, dataId, now = Date.now(), toleranceSeconds = 300 }) {
  if (!secret || !signature || !requestId || !dataId) return false;
  const fields = Object.fromEntries(String(signature).split(",").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([key, value]) => key && value));
  if (!fields.ts || !fields.v1 || !/^\d+$/.test(fields.ts)) return false;
  const rawTimestamp = Number(fields.ts);
  const timestamp = rawTimestamp < 1_000_000_000_000 ? rawTimestamp * 1000 : rawTimestamp;
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > toleranceSeconds * 1000) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${fields.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  let supplied;
  if (!/^[a-f\d]{64}$/i.test(fields.v1)) return false;
  try { supplied = Buffer.from(fields.v1, "hex"); } catch { return false; }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
