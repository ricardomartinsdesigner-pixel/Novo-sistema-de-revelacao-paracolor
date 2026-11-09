export const CAMPAIGN_AREAS = {
  revelacao: { label: "Revelação", entity: "PhotoSize", href: "/revelacao" },
  polaroid: { label: "Polaroides", entity: "PolaroidModel", href: "/polaroids" },
  banner: { label: "Banners", entity: "BannerSize", href: "/banners" },
  personalizado: { label: "Personalizados", entity: "CustomProduct", href: "/personalizados" },
  moldura: { label: "Molduras", entity: "Frame", href: "/molduras" },
};

export const CAMPAIGN_MODES = {
  publico: "Cupom público",
  exclusivo: "Cupom exclusivo",
  automatico: "Desconto automático",
};

export const normalizeCoupon = (value) => String(value || "").trim().toUpperCase();
const money = (value) => Math.round(Number(value) * 100) / 100;

function localInstant(value, end = false) {
  const calendar = Date.parse(value + ":00Z");
  if (!Number.isFinite(calendar) || new Date(calendar).toISOString().slice(0, 16) !== value) return NaN;
  return Date.parse(value + (end ? ":59.999-03:00" : ":00-03:00"));
}

export function campaignWindow(coupon) {
  const starts = coupon.starts_at ? localInstant(coupon.starts_at) : -Infinity;
  const ends = coupon.ends_at
    ? localInstant(coupon.ends_at, true)
    : !coupon.campaign_mode && coupon.expires_at
      ? Date.parse(coupon.expires_at.slice(0, 10) + "T23:59:59.999-03:00")
      : Infinity;
  return { starts, ends };
}

export function campaignStatus(coupon, now = Date.now()) {
  const { starts, ends } = campaignWindow(coupon);
  if (!coupon.active) return "Pausado";
  if (Number.isNaN(starts) || Number.isNaN(ends) || now > ends) return "Vencido";
  if (now < starts) return "Agendado";
  return "Ativo";
}

export function discountForCampaign(coupon, items, user, now = Date.now()) {
  if (campaignStatus(coupon, now) !== "Ativo" || (coupon.campaign_mode === "exclusivo" && (!user?.id || user.id !== coupon.customer_id))) {
    return { reason: "Cupom indisponível para esta conta ou fora da validade." };
  }
  const targets = items.filter(({ input }) =>
    (!coupon.area || input.area === coupon.area) && (!coupon.product_id || input.ref_id === coupon.product_id)
  );
  const eligible = coupon.campaign_mode ? targets.filter((item) =>
    (coupon.allow_professional || item.input.options?.pricing_table !== "profissional") &&
    (coupon.allow_product_promo || !item.product_promo)
  ) : targets;
  if (!eligible.length) {
    return { reason: targets.length ? "Este desconto não é cumulativo com os preços especiais dos itens elegíveis." : "Este cupom não se aplica aos itens deste pedido." };
  }
  const subtotal = money(eligible.reduce((sum, item) => sum + item.line_total, 0));
  if (subtotal < Number(coupon.min_total || 0)) return { reason: "Os itens elegíveis não atingiram o valor mínimo do cupom." };
  if (eligible.reduce((sum, item) => sum + item.qty, 0) < Number(coupon.min_quantity || 0)) {
    return { reason: "Os itens elegíveis não atingiram a quantidade mínima do cupom." };
  }
  const value = Number(coupon.value);
  if (!Number.isFinite(value) || value <= 0 || (coupon.type === "percent" && value > 100)) return { reason: "Valor de cupom inválido." };
  const discount = Math.min(subtotal, money(coupon.type === "percent" ? subtotal * value / 100 : value), Number(coupon.max_discount) || Infinity);
  return discount > 0 ? { discount: money(discount) } : { reason: "O cupom não gerou desconto para estes itens." };
}
