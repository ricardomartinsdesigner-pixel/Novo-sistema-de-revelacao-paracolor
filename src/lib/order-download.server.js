import { createHmac, timingSafeEqual } from "node:crypto";
import { hasStaffAccess } from "./staff-access.js";

export const canAccessOrder = (user, order) => Boolean(user?.id && (hasStaffAccess(user, "production") || user.id === order.created_by_id));

function sign(userId, orderId, only, size, expires) {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres aleatórios.");
  return createHmac("sha256", secret).update(JSON.stringify(["order-zip-v2", userId, orderId, only, size, expires])).digest("hex");
}

export function createOrderDownload(user, order, only = "all", size = "") {
  const expires = Date.now() + 15 * 60_000;
  const token = sign(user.id, order.id, only, size, expires);
  const params = new URLSearchParams({ orderId: order.id, only, size, expires: String(expires), token });
  return { url: `/api/order-zip?${params}`, expires_at: new Date(expires).toISOString() };
}

export function verifyOrderDownload(user, orderId, only, size, expires, token, now = Date.now()) {
  const expiry = Number(expires);
  if (!user?.id || !/^[a-f0-9]{64}$/.test(token || "") || !Number.isSafeInteger(expiry) || expiry <= now || expiry > now + 15 * 60_000) return false;
  return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(sign(user.id, orderId, only, size, expiry), "hex"));
}
