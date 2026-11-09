import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/auth-middleware";
import { campaignUsage, hasAutomaticCampaign, lockCampaigns, visibleCampaigns } from "@/lib/coupons.server";
import { CAMPAIGN_AREAS, CAMPAIGN_MODES, campaignStatus, campaignWindow, normalizeCoupon } from "@/lib/coupon-rules";
import { ensureDatabase, getPool, withTransaction } from "@/lib/vps/db.server";
import { makeEntityService } from "@/lib/vps/entities.server";

const dateTime = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Escolha a data e a hora.")]);
const optionalAmount = z.number().min(0).max(1_000_000);
const CampaignInput = z.object({
  id: z.string().max(120).optional(),
  title: z.string().trim().min(1, "Dê um nome à campanha.").max(100),
  code: z.string().trim().max(40),
  campaign_mode: z.enum(Object.keys(CAMPAIGN_MODES)),
  customer_id: z.string().max(120),
  area: z.enum(["", ...Object.keys(CAMPAIGN_AREAS)]),
  product_id: z.string().max(120),
  type: z.enum(["percent", "fixed"]),
  value: z.number().min(0.01).max(1_000_000),
  min_total: optionalAmount,
  min_quantity: z.number().int().min(0).max(50_000),
  max_discount: optionalAmount,
  max_uses: optionalAmount.int(),
  per_customer: optionalAmount.int(),
  starts_at: dateTime,
  ends_at: dateTime,
  active: z.boolean(),
  allow_professional: z.boolean(),
  allow_product_promo: z.boolean(),
  notice: z.enum(["none", "banner", "popup"]),
  message: z.string().trim().max(240),
  image_url: z.string().trim().max(500),
});

function assertAdmin(user) {
  if (user.role !== "admin") throw new Error("Acesso exclusivo de administradores.");
}

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ offset: z.number().int().min(0) }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.user);
    await ensureDatabase();
    const db = getPool();
    const { rows } = await db.query(`
      SELECT c.id, c.data, COALESCE(NULLIF(u.data->>'full_name',''), u.data->>'email') AS customer_name,
        u.data->>'email' AS customer_email
      FROM vps_records c LEFT JOIN vps_records u ON u.entity='User' AND u.id = c.data->>'customer_id'
      WHERE c.entity='Coupon' ORDER BY c.created_at DESC, c.id DESC LIMIT 26 OFFSET $1
    `, [data.offset]);
    const items = await Promise.all(rows.slice(0, 25).map(async ({ id, data: saved, customer_name, customer_email }) => {
      const coupon = { ...saved, id };
      return { ...coupon, customer_name, customer_email, status: campaignStatus(coupon), usage: await campaignUsage(db, coupon) };
    }));
    return { items, nextOffset: rows.length > 25 ? data.offset + 25 : null };
  });

export const saveCampaign = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(CampaignInput)
  .handler(async ({ data, context }) => {
    assertAdmin(context.user);
    if (data.type === "percent" && data.value > 100) throw new Error("O percentual deve ficar entre 0,01% e 100%.");
    const { starts, ends } = campaignWindow(data);
    if (Number.isNaN(starts) || Number.isNaN(ends) || starts > ends) throw new Error("Confira o início e o fim da campanha.");
    if (data.starts_at && data.ends_at && data.starts_at > data.ends_at) throw new Error("O fim precisa ser depois do início.");
    if (data.campaign_mode !== "publico" && !data.ends_at) throw new Error("Defina a validade do cupom exclusivo ou do desconto automático.");
    if (data.image_url && !/^https:\/\/[^\s]+$|^\/api\/files\/[0-9a-f-]{36}$/i.test(data.image_url)) {
      throw new Error("Use um endereço HTTPS ou envie a imagem pelo painel.");
    }
    const { id, ...campaign } = data;
    const mode = campaign.campaign_mode;
    const code = normalizeCoupon(campaign.code) || "PC-" + randomBytes(5).toString("hex").toUpperCase();
    if (!id && !/^[A-Z0-9_-]{2,40}$/.test(code)) throw new Error("Use de 2 a 40 letras, números, hífens ou sublinhados no código.");

    return withTransaction(async (db) => {
      await lockCampaigns(db);
      const { entities } = makeEntityService(context.user, true, db);
      const previous = id ? await entities.Coupon.get(id) : null;
      if (previous && previous.campaign_mode && (previous.campaign_mode !== mode || normalizeCoupon(previous.code) !== code || (previous.customer_id || "") !== (mode === "exclusivo" ? campaign.customer_id : ""))) {
        throw new Error("O tipo, o código e o titular são fixos após a criação. Crie outra campanha para trocar esses dados.");
      }
      if (!/^[A-Z0-9_-]{2,40}$/.test(code) && (!previous || normalizeCoupon(previous.code) !== code)) {
        throw new Error("Use de 2 a 40 letras, números, hífens ou sublinhados no código.");
      }
      const conflict = await db.query(
        "SELECT 1 FROM vps_records WHERE entity='Coupon' AND UPPER(TRIM(data->>'code'))=$1 AND id<>$2 LIMIT 1",
        [code, id ?? ""],
      );
      if (conflict.rowCount && (!previous || normalizeCoupon(previous.code) !== code)) throw new Error("Já existe uma campanha com este código.");
      if (mode === "exclusivo") {
        const customer = campaign.customer_id && await entities.User.get(campaign.customer_id).catch(() => null);
        if (!customer || customer.role === "admin" || customer.account_deleted) throw new Error("Selecione uma conta de cliente ativa.");
        campaign.max_uses ||= 1;
        campaign.per_customer ||= 1;
      } else {
        campaign.customer_id = "";
      }
      const product = campaign.product_id && CAMPAIGN_AREAS[campaign.area]
        ? await entities[CAMPAIGN_AREAS[campaign.area].entity].get(campaign.product_id).catch(() => null)
        : null;
      if (campaign.product_id && !product) throw new Error("Selecione um produto ou formato válido da área.");
      const record = {
        ...campaign, code, product_name: product?.name || "",
        notice: mode === "exclusivo" ? "none" : campaign.notice,
        expires_at: "",
      };
      const saved = id ? await entities.Coupon.update(id, record) : await entities.Coupon.create(record);
      return { id: saved.id, code: saved.code };
    });
  });

export const setCampaignActive = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1).max(120), active: z.boolean() }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.user);
    return withTransaction(async (db) => {
      await lockCampaigns(db);
      await makeEntityService(context.user, true, db).entities.Coupon.update(data.id, { active: data.active });
      return { ok: true };
    });
  });

export const getPublicCampaigns = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const settings = (await context.getBase44().asServiceRole.entities.Settings.list({ limit: 1, sort: "-created_date" })).items[0];
  if (settings?.module_promocoes === false) return { offers: [], automatic: false };
  const db = getPool();
  const [offers, automatic] = await Promise.all([visibleCampaigns(db), hasAutomaticCampaign(db)]);
  return { offers, automatic };
});

export const getMyCoupons = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await ensureDatabase();
    return visibleCampaigns(getPool(), context.user.id, context.getBase44().asServiceRole);
  });

export const listCampaignOrders = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1).max(120), offset: z.number().int().min(0) }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.user);
    await ensureDatabase();
    const { rows } = await getPool().query(`
      SELECT o.id, o.created_at AS created_date, o.data->>'order_number' AS order_number,
        o.data->>'discount' AS discount, o.data->>'total' AS total
      FROM vps_records c JOIN vps_records o ON o.entity='Order' AND (
        o.data->>'coupon_id'=c.id OR
        (NOT (o.data ? 'coupon_id') AND UPPER(TRIM(o.data->>'coupon_code'))=UPPER(TRIM(c.data->>'code')))
      )
      WHERE c.entity='Coupon' AND c.id=$1 AND o.data->>'payment_status'='aprovado'
      ORDER BY o.created_at DESC, o.id DESC LIMIT 21 OFFSET $2
    `, [data.id, data.offset]);
    return { items: rows.slice(0, 20), nextOffset: rows.length > 20 ? data.offset + 20 : null };
  });
