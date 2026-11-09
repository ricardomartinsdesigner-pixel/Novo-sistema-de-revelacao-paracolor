import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/order-payment";
import { PHOTO_COLOR_EFFECTS } from "./photo-color-effects.js";
import { MAX_ORDER_PHOTOS } from "@/lib/photo-order";
const text = (max) => z.string().max(max);
const selections = z.record(text(120), text(500)).refine((value) => Object.keys(value).length <= 20, "Há opções demais neste item.");
const PhotoInput = z.object({
  position: z.number().int().min(0).max(MAX_ORDER_PHOTOS - 1).optional(),
  filename: text(240).optional(), original_file_uri: text(600).min(1), print_file_uri: text(600).optional(),
  print_name: text(240).optional(), size_name: text(120).optional(),
  width_cm: z.number().min(0).max(1000).optional(), height_cm: z.number().min(0).max(1000).optional(),
  print_orientation: z.enum(["landscape", "portrait", "square"]).optional(),
  color_effect: z.enum(Object.keys(PHOTO_COLOR_EFFECTS)).optional(),
  fit_mode: text(30).optional(), border: z.boolean().optional(), zoom: z.number().min(0.2).max(10).optional(),
  offset_x: z.number().min(-10).max(10).optional(), offset_y: z.number().min(-10).max(10).optional(),
  rotation: z.number().min(-360).max(360).optional(), flip_h: z.boolean().optional(), flip_v: z.boolean().optional(),
  quality: text(30).optional(), alerts: z.array(text(60)).max(10).optional(), caption: text(400).optional(),
  caption_style: z.object({ font: text(30).optional(), size: z.number().min(0.01).max(0.2).optional(), color: text(30).optional(), align: text(20).optional(), element: text(20).optional(), bold: z.boolean().optional() }).optional(),
  caption_area_enabled: z.boolean().optional(),
  polaroid_model: text(120).optional(), copies: z.number().int().min(1).max(50).optional(), confirmed_issue: z.boolean().optional(),
});
const OptionsInput = z.object({
  width_cm: z.number().min(20).max(1000).optional(), height_cm: z.number().min(20).max(1000).optional(),
  material_id: text(120).optional(), finish_ids: z.array(text(120)).max(20).optional(),
  magnet_kind: z.enum(["photo", "polaroid", "strip_kit"]).optional(),
  magnet_style: z.enum(["photo", "border", "polaroid"]).optional(),
  magnet_print_sheet_uri: text(600).optional(), magnet_layout: text(12000).optional(),
  art_mode: z.enum(["upload", "equipe"]).optional(), art_file_uri: text(600).optional(), art_original_name: text(240).optional(),
  instructions: text(1000).optional(),
  art_approval_mode: z.enum(["desativada", "opcional", "obrigatoria"]).optional(), art_approval_requested: z.boolean().optional(),
  variation_name: text(120).optional(), variation_option: text(200).optional(), variations: selections.optional(),
  addons: z.array(text(120)).max(20).optional(), text_values: selections.optional(), photo_labels: z.array(text(120)).max(20).optional(),
  product_code: text(120).optional(), preview_uri: text(600).optional(),
});
const ItemInput = z.object({
  area: z.enum(["revelacao", "polaroid", "magnet", "banner", "personalizado", "moldura"]), ref_id: text(120).min(1),
  product_name: text(200).min(1), variant: text(240).optional(), qty: z.number().int().min(1).max(99),
  options: OptionsInput.optional(), photos: z.array(PhotoInput).max(MAX_ORDER_PHOTOS).optional(), preview_uri: text(600).optional(),
});
export const QuoteInput = z.object({
  items: z.array(ItemInput).min(1).max(40).refine((items) => items.reduce((n, item) => n + (item.photos?.length || 0), 0) <= MAX_ORDER_PHOTOS, "Limite de 1.000 fotos por pedido."),
  fulfillment: z.enum(["retirada", "entrega"]), coupon_code: text(40).optional(),
  shipping_cep: text(12).optional(), shipping_service: text(60).optional(),
});
export const OrderInput = QuoteInput.extend({
  checkout_key: z.string().uuid(), customer_name: text(120).min(2), customer_email: z.string().email().max(160),
  customer_phone: text(40).min(8), customer_cpf: text(20).optional(), shipping_cep: text(12).optional(),
  shipping_address: text(400).optional(), gift_message: text(500).optional(),
  payment_method: z.enum(PAYMENT_METHODS),
  quoted_total: z.number().nonnegative().optional(),
});
