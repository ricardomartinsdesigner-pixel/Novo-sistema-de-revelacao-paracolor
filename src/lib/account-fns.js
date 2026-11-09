import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { searchClients } from "@/lib/client-search.server";
import { hasStaffAccess } from "@/lib/staff-access";

const CONFIRM_WORD = "EXCLUIR";

export const findClients = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ term: z.string().max(160), offset: z.number().int().min(0), professional: z.boolean().optional() }))
  .handler(({ data, context }) => {
    if (!hasStaffAccess(context.user, "clients")) throw new Error("Acesso restrito aos níveis de atendimento, gerência e administração.");
    return searchClients(data.term, data.offset, data.professional);
  });

export const updateClientProfile = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({
    id: z.string().min(1),
    full_name: z.string().trim().min(1).max(160),
    phone: z.string().trim().max(40),
    address: z.string().trim().max(400),
    professional_pricing: z.boolean(),
    allow_pickup_payment: z.boolean(),
  }))
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem alterar o cadastro de clientes.");
    const { id, ...profile } = data;
    await context.getBase44().asServiceRole.entities.User.update(id, {
      ...profile,
      allow_pickup_payment: profile.professional_pricing && profile.allow_pickup_payment,
    });
    return { ok: true };
  });

// O cliente pede a exclusão definitiva; a loja processa depois.
export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ confirm: z.string().max(20), reason: z.string().max(600).optional() }))
  .handler(async ({ data, context }) => {
    if (data.confirm.trim().toUpperCase() !== CONFIRM_WORD) {
      throw new Error(`Digite ${CONFIRM_WORD} para confirmar a exclusão.`);
    }
    const base44 = context.getBase44();
    const existing = await base44.entities.AccountDeletionRequest.filter(
      { created_by_id: context.user.id, status: "pendente" },
      { limit: 1 }
    );
    if ((existing.items ?? []).length) throw new Error("Você já tem uma solicitação de exclusão em análise.");

    return base44.entities.AccountDeletionRequest.create({
      user_id: context.user.id,
      user_email: context.user.email,
      user_name: context.user.full_name ?? "",
      reason: data.reason?.trim() ?? "",
      status: "pendente",
      requested_at: new Date().toISOString(),
    });
  });

// Apaga os dados pessoais do cliente, mantendo apenas os pedidos sem identificação.
async function eraseCustomerData(role, request) {
  await role.entities.User.update(request.user_id, {
    full_name: "Cliente excluído",
    phone: "",
    address: "",
  });

  const orders = await role.entities.Order.filter(
    { $or: [{ created_by_id: request.user_id }, { customer_email: request.user_email }] },
    { limit: 500 }
  );
  const list = orders.items ?? [];

  if (list.length) {
    await role.entities.Order.bulkUpdate(
      list.map((order) => ({
        id: order.id,
        customer_name: "Cliente excluído",
        customer_email: "",
        customer_phone: "",
        customer_cpf: "",
        customer_user_id: "",
        shipping_address: "",
        shipping_cep: "",
        gift_message: "",
      }))
    );
  }

  const orderIds = list.map((order) => order.id);
  let photos = 0;
  if (orderIds.length) {
    photos = await role.entities.OrderPhoto.count({ order_id: { $in: orderIds } });
    if (photos) await role.entities.OrderPhoto.deleteMany({ order_id: { $in: orderIds } });
  }

  const leads = await role.entities.CartLead.count({ user_id: request.user_id });
  if (leads) await role.entities.CartLead.deleteMany({ user_id: request.user_id });

  return { orders: list.length, photos, leads };
}

export const processAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      request_id: z.string().min(1),
      action: z.enum(["processar", "recusar"]),
      note: z.string().max(600).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem processar exclusões.");
    const role = context.getBase44().asServiceRole;
    const request = await role.entities.AccountDeletionRequest.get(data.request_id);
    if (request.status !== "pendente") throw new Error("Esta solicitação já foi tratada.");

    const result =
      data.action === "processar"
        ? await eraseCustomerData(role, request)
        : { orders: 0, photos: 0, leads: 0 };

    const updated = await role.entities.AccountDeletionRequest.update(request.id, {
      status: data.action === "processar" ? "processado" : "recusado",
      processed_by: context.user.full_name || context.user.email || "admin",
      processed_at: new Date().toISOString(),
      note: data.note?.trim() ?? "",
    });

    return { ...result, status: updated.status, user_email: request.user_email };
  });
