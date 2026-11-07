export function promosEnabled(settings) {
  return settings ? settings.module_promocoes !== false : true;
}

/** Preço promocional do produto, respeitando o módulo de promoções da loja. */
export function promoPrice(product, settings) {
  if (!product || !promosEnabled(settings)) return 0;
  return Number(product.promo_price) || 0;
}

export function effectivePrice(product, settings) {
  return promoPrice(product, settings) || Number(product?.price) || 0;
}