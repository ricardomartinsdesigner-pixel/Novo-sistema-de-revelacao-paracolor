import { isPhotoArea, photoCategory, photoCounts, pricingContext } from "@/lib/quantity-pricing";
import { pickShippingOption } from "@/lib/shipping.server";
import { daysForArea, formatDeadlineDuration } from "@/lib/deadline";

const ENTITY = { revelacao: "PhotoSize", polaroid: "PolaroidModel", banner: "BannerSize", personalizado: "CustomProduct", moldura: "Frame" };
const MODULE = { revelacao: "revelacao", polaroid: "polaroids", banner: "banners", personalizado: "personalizados", moldura: "molduras" };
const money = (value) => Math.round(Number(value) * 100) / 100;
const rows = (value) => Array.isArray(value) ? value : value.items;

async function loadCatalog(role, items) {
  const groups = {};
  for (const item of items) {
    (groups[ENTITY[item.area]] ??= new Set()).add(item.ref_id);
    if (item.area === "banner") {
      const ids = [item.options?.material_id, ...(item.options?.finish_ids || [])].filter(Boolean);
      ids.forEach((id) => (groups.BannerOption ??= new Set()).add(id));
    }
  }
  const entries = await Promise.all(Object.entries(groups).map(async ([entity, ids]) => {
    const records = rows(await role.entities[entity].filter({ id: { $in: [...ids] } }, { limit: ids.size }));
    return [entity, new Map(records.map((record) => [record.id, record]))];
  }));
  return Object.fromEntries(entries);
}

function photoLines(items) {
  return items.flatMap((item) =>
    isPhotoArea(item.area)
      ? (item.photos || []).map((photo) => ({ area: item.area, sizeId: item.ref_id, copies: photo.copies || 1 }))
      : []
  );
}

// Quantity tiers are read from the shop's price table. Without any configuration
// the catalog price is kept, so the checkout never depends on a seeded table.
async function loadTierContext(role, items) {
  try {
    const [tiers, tierPrices, groups] = await Promise.all([
      role.entities.QuantityTier.filter({ active: true }, { limit: 100 }),
      role.entities.TierPrice.filter({}, { limit: 1000 }),
      role.entities.PriceGroup.filter({ active: true }, { limit: 100 }),
    ]);
    return pricingContext({
      tiers: rows(tiers),
      tierPrices: rows(tierPrices),
      groups: rows(groups),
      counts: photoCounts(photoLines(items)),
    });
  } catch {
    return { revelacao: {}, polaroid: {} };
  }
}

function activeRecord(catalog, entity, id) {
  const record = catalog[entity]?.get(id);
  if (!record || record.active === false) throw new Error("Um produto não está mais disponível. Remova-o do carrinho para continuar.");
  return record;
}

function priceItem(catalog, input, settings, tierContext) {
  if (settings[`module_${MODULE[input.area]}`] === false) throw new Error("Uma área deste pedido está desativada. Revise o carrinho.");
  const record = activeRecord(catalog, ENTITY[input.area], input.ref_id);
  const options = { ...input.options };
  let photos = input.photos || [];
  let qty = input.qty;
  let unit = Number(record.price) || 0;
  const tierInfo = isPhotoArea(input.area) ? tierContext?.[photoCategory(input.area)]?.[input.ref_id] : null;
  if (tierInfo) unit = Number(tierInfo.unit) || 0;
  let total;
  let name = record.name;
  let variant = "";
  let approvalMode = "desativada";

  if (["revelacao", "polaroid"].includes(input.area)) {
    if (!photos.length || photos.some((photo) => !photo.print_file_uri)) throw new Error("As fotos precisam dos arquivos de impressão. Prepare-as novamente no editor.");
    qty = photos.reduce((sum, photo) => sum + (photo.copies || 1), 0);
    total = photos.reduce((sum, photo) => sum + (unit + (input.area === "revelacao" && photo.border ? Number(record.border_price) || 0 : 0)) * (photo.copies || 1), 0);
    photos = photos.map((photo) => ({ ...photo, width_cm: record.width_cm, height_cm: record.height_cm, size_name: record.name }));
    name = `${input.area === "revelacao" ? "Revelação" : "Polaroid"} ${record.name}`;
    variant = record.name;
    if (tierInfo) {
      options.tier_label = tierInfo.tier?.label || "";
      options.tier_quantity = tierInfo.count;
    }
  } else if (input.area === "banner") {
    const width = options.width_cm || record.width_cm;
    const height = options.height_cm || record.height_cm;
    if (!(width >= 20 && width <= 1000 && height >= 20 && height <= 1000)) throw new Error("Confira as medidas do banner.");
    let perM2 = Number(record.price_per_m2) || 0;
    const parts = [];
    if (options.material_id) {
      const material = activeRecord(catalog, "BannerOption", options.material_id);
      if (material.kind !== "material") throw new Error("Material do banner inválido.");
      perM2 += Number(material.price_per_m2) || 0;
      parts.push(material.name);
    }
    unit = (Number(record.base_price) || 0) + width * height / 10000 * perM2;
    for (const id of new Set(options.finish_ids || [])) {
      const finish = activeRecord(catalog, "BannerOption", id);
      if (finish.kind !== "acabamento") throw new Error("Acabamento do banner inválido.");
      unit += Number(finish.price_fixed) || 0;
      parts.push(finish.name);
    }
    if (options.art_mode !== "equipe" && !options.art_file_uri) throw new Error("Envie a arte do banner antes de concluir.");
    name = `Banner ${width}x${height} cm`;
    variant = parts.join(" · ");
    approvalMode = options.art_mode === "equipe" ? "obrigatoria" : "opcional";
  } else if (input.area === "personalizado") {
    const promoActive = settings.module_promocoes !== false;
    unit = (promoActive ? Number(record.promo_price) : 0) || Number(record.price) || 0;
    const selected = options.variations || { [options.variation_name]: options.variation_option };
    const parts = [];
    for (const variation of record.variations || []) {
      const option = (variation.options || []).find((candidate) => (typeof candidate === "string" ? candidate : candidate.label) === selected[variation.name]);
      if (!option) throw new Error(`Escolha uma opção válida de ${variation.name}.`);
      if (typeof option === "object") unit += Number(option.price_delta) || 0;
      parts.push(`${variation.name}: ${selected[variation.name]}`);
    }
    for (const label of new Set(options.addons || [])) {
      const addon = (record.addons || []).find((candidate) => candidate.label === label);
      if (!addon) throw new Error("Um adicional deste produto não está mais disponível.");
      unit += Number(addon.price) || 0;
      parts.push(label);
    }
    const photoFields = record.photo_fields?.length ? record.photo_fields : [{ label: "Foto para o produto", required: true }];
    for (const field of photoFields) {
      if (field.required && !photos.some((photo) => photo.size_name === field.label)) throw new Error(`Envie a foto “${field.label}”.`);
    }
    for (const field of record.text_fields || []) {
      const value = options.text_values?.[field.label] || "";
      if (field.required && !value.trim()) throw new Error(`Preencha “${field.label}”.`);
      if (value.length > (field.max_length || 120)) throw new Error(`O texto de “${field.label}” está muito longo.`);
    }
    if (record.stock !== undefined && record.stock !== null && qty > record.stock) throw new Error(`Quantidade indisponível para ${record.name}.`);
    approvalMode = record.art_approval_mode || "desativada";
    variant = parts.join(" · ");
  } else {
    if (!settings.module_molduras_online || record.mode !== "compra") throw new Error("Esta moldura está disponível apenas para consulta.");
    variant = [record.color, record.material].filter(Boolean).join(" · ");
  }
  if (!Number.isFinite(unit) || unit < 0) throw new Error("O preço deste produto precisa ser revisado pela loja.");
  unit = money(unit);
  options.art_approval_mode = approvalMode;
  options.art_approval_requested = approvalMode === "obrigatoria" || (approvalMode === "opcional" && options.art_approval_requested === true);
  const productionDays = input.area === "personalizado" && Number(record.production_days) > 0
    ? Number(record.production_days)
    : daysForArea(settings, input.area);
  const productionLabel = input.area === "personalizado" && Number(record.production_days) > 0
    ? `${productionDays} dia(s) útil(eis)`
    : formatDeadlineDuration(settings, input.area);
  return { input: { ...input, options, photos }, qty, unit_price: unit, line_total: money(total ?? unit * qty), product_name: name, variant, production_days: productionDays, production_label: productionLabel };
}

export async function computeCheckout(role, data, defaults) {
  const settings = { ...defaults, ...rows(await role.entities.Settings.list({ sort: "-created_date", limit: 1 }))[0] };
  const catalog = await loadCatalog(role, data.items);
  const tierContext = await loadTierContext(role, data.items);
  const items = data.items.map((item) => priceItem(catalog, item, settings, tierContext));
  const subtotal = money(items.reduce((sum, item) => sum + item.line_total, 0));
  let discount = 0;
  const couponCode = (data.coupon_code || "").trim().toUpperCase();
  if (couponCode) {
    const coupon = rows(await role.entities.Coupon.filter({ code: couponCode, active: true }, { limit: 1 }))[0];
    const expires = coupon?.expires_at ? new Date(`${coupon.expires_at.slice(0, 10)}T23:59:59-03:00`).getTime() : Infinity;
    if (!coupon || expires < Date.now()) throw new Error("Cupom inválido ou expirado.");
    if (subtotal < Number(coupon.min_total || 0)) throw new Error("O pedido não atingiu o valor mínimo do cupom.");
    discount = Math.min(subtotal, Math.max(0, money(coupon.type === "percent" ? subtotal * Number(coupon.value) / 100 : coupon.value)));
  }
  let shipping_cost = 0;
  let shipping_label = "";
  if (data.fulfillment === "entrega") {
    const option = data.shipping_service
      ? await pickShippingOption(role, { to_cep: data.shipping_cep, service_id: data.shipping_service, insurance: subtotal }).catch(() => null)
      : null;
    if (option) {
      shipping_cost = money(option.price);
      shipping_label = [option.company, option.name].filter(Boolean).join(" · ");
    } else if (settings.shipping_enabled) {
      shipping_cost = money(Math.max(0, Number(settings.shipping_flat) || 0));
    } else if (String(data.shipping_cep || "").replace(/\D/g, "").length === 8) {
      throw new Error("Não foi possível calcular o frete para este endereço. Confira o CEP ou escolha retirada na loja.");
    }
  }
  return { items, settings, subtotal, discount, shipping_cost, shipping_label, total: money(subtotal - discount + shipping_cost), coupon_code: couponCode };
}
