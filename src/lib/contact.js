/**
 * Helpers for the store's public contact channels. Everything comes from the
 * panel settings: nothing here invents a phone, handle or opening hour.
 */

export function whatsappUrl(phone, message = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  const base = `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telHref(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 8) return "";
  return `tel:+${digits.startsWith("55") ? digits : `55${digits}`}`;
}

export function instagramUrl(handle) {
  const value = String(handle || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://instagram.com/${value.replace(/^@/, "")}`;
}

export function instagramHandle(handle) {
  const value = String(handle || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    const match = value.match(/instagram\.com\/([^/?#]+)/i);
    return match ? `@${match[1].replace(/^@/, "")}` : value;
  }
  return value.startsWith("@") ? value : `@${value}`;
}

/** Message sent to WhatsApp when a visitor asks about a specific service. */
export function serviceMessage(template, serviceTitle) {
  const base = String(template || "").trim() || "Olá! Vim pelo site da Paracolor.";
  return serviceTitle ? `${base}\n\nServiço: ${serviceTitle}` : base;
}