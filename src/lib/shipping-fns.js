import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { quoteMelhorEnvio } from "@/lib/shipping.server";

export const quoteShippingOptions = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ cep: z.string().min(8).max(12), subtotal: z.number().min(0).max(1000000).optional() }))
  .handler(async ({ data, context }) => {
    const options = await quoteMelhorEnvio(context.getBase44(), { to_cep: data.cep, insurance: data.subtotal });
    return { options: options ?? [] };
  });

// Consulta pública de frete (páginas de produto, antes do login): devolve só a
// opção mais barata, sem expor token ou a lista completa de serviços.
export const estimateShipping = createServerFn({ method: "POST" })
  .validator(z.object({ cep: z.string().min(8).max(9) }))
  .handler(async ({ data, context }) => {
    const digits = data.cep.replace(/\D/g, "");
    if (digits.length !== 8) return { options: [] };
    const options = await quoteMelhorEnvio(context.getBase44().asServiceRole, { to_cep: digits, insurance: 80 });
    const best = (options ?? []).filter((option) => option.price > 0).sort((a, b) => a.price - b.price)[0];
    return { options: best ? [{ price: best.price, days: best.days, company: best.company }] : [] };
  });