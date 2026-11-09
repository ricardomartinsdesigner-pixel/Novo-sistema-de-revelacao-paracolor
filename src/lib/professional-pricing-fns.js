import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import {
  loadProfessionalPricing,
  professionalPricingRecord,
  saveProfessionalPricingRecord,
} from "@/lib/professional-pricing.server";

const id = z.string().min(1).max(120);
const quantity = z.number().int().min(0).max(50_000);
const Table = z.object({
  tiers: z.array(z.object({
    id,
    label: z.string().trim().max(80),
    min_qty: quantity.nullable(),
    max_qty: quantity.nullable(),
  })).max(100),
  prices: z.array(z.object({
    tier_id: id,
    size_id: id,
    unit_price: z.number().positive().max(100_000),
  })).max(10_000),
  shared_size_ids: z.array(id).max(1000),
});

export const getProfessionalPricing = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(({ context }) => loadProfessionalPricing(context.getBase44().asServiceRole, context.user));

export const getProfessionalPricingAdmin = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem consultar a tabela profissional.");
    return await professionalPricingRecord(context.getBase44().asServiceRole) ?? null;
  });

export const saveProfessionalPricing = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ table: Table, revision: z.number().int().nonnegative(), publish: z.boolean() }))
  .handler(({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem salvar a tabela profissional.");
    return saveProfessionalPricingRecord(context.getBase44().asServiceRole, context.user, data);
  });
