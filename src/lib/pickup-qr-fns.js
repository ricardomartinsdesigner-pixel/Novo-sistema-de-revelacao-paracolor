import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { needsArtApproval } from "@/lib/order-production";
import { withTransaction } from "@/lib/vps/db.server";
import { makeEntityService } from "@/lib/vps/entities.server";
import { canUpdateOrderAsStaff, hasStaffAccess } from "@/lib/staff-access";
import { checkCouponPaymentDeadline, lockCampaigns } from "@/lib/coupons.server";
import { enqueueOrderNotice, sendPendingOrderNotices } from "@/lib/order-notices.server";
import { awaitsPickupPayment, STORE_PAYMENT } from "@/lib/order-payment";

const list = (value) => Array.isArray(value) ? value : value?.items ?? [];
const token = () => `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
const summary = (order) => ({
  id: order.id,
  order_number: order.order_number,
  customer_name: order.customer_name,
  status: order.status,
  payment_status: order.payment_status,
  fulfillment: order.fulfillment,
  total: Number(order.total) || 0,
});

async function lockOrder(db, orderId) {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 1))", [orderId]);
}

export const ensurePickupQrToken = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1).max(120) }))
  .handler(async ({ data, context }) => withTransaction(async (db) => {
    await lockOrder(db, data.order_id);
    const role = makeEntityService(context.user, true, db);
    const order = await role.entities.Order.get(data.order_id);
    const ownsOrder = order.customer_user_id === context.user.id || order.created_by_id === context.user.id;
    if (!ownsOrder && context.user.role !== "admin") throw new Error("Você não tem acesso a este pedido.");
    if (order.fulfillment !== "retirada") throw new Error("O QR Code está disponível somente para pedidos com retirada na loja.");
    if (order.pickup_qr_token) return { token: order.pickup_qr_token };
    const value = token();
    await role.entities.Order.update(order.id, { pickup_qr_token: value });
    return { token: value };
  }));

export const savePickupQrBehavior = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ behavior: z.enum(["automatico", "confirmar", "consultar"]) }))
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Apenas administradores podem alterar o comportamento do QR Code.");
    const settings = context.getBase44().asServiceRole.entities.Settings;
    const record = list(await settings.list({ sort: "-created_date", limit: 1 }))[0];
    if (record) await settings.update(record.id, { pickup_qr_behavior: data.behavior });
    else await settings.create({ pickup_qr_behavior: data.behavior });
    return { behavior: data.behavior };
  });

export const resolvePickupQr = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({
    token: z.string().trim().min(32).max(120),
    action: z.enum(["scan", "confirm", "undo"]).default("scan"),
  }))
  .handler(async ({ data, context }) => {
    if (!hasStaffAccess(context.user, "orders")) throw new Error("Seu acesso não permite consultar pedidos.");
    const base44 = context.getBase44();
    const settings = list(await base44.asServiceRole.entities.Settings.list({ sort: "-created_date", limit: 1 }))[0];
    const behavior = ["automatico", "confirmar", "consultar"].includes(settings?.pickup_qr_behavior)
      ? settings.pickup_qr_behavior : "automatico";

    const result = await withTransaction(async (db) => {
      const role = makeEntityService(context.user, true, db);
      const matches = list(await role.entities.Order.filter({ pickup_qr_token: data.token }, { limit: 2 }));
      if (matches.length !== 1) throw new Error("QR Code inválido ou não encontrado.");
      await lockOrder(db, matches[0].id);
      const order = await role.entities.Order.get(matches[0].id);
      if (order.pickup_qr_token !== data.token) throw new Error("QR Code inválido ou não encontrado.");
      const date = new Date().toISOString();

      if (data.action === "undo") {
        const canUndo = order.status === "retirado"
          && order.pickup_qr_redeemed_by === context.user.id
          && Date.now() - Date.parse(order.pickup_qr_redeemed_at || "") <= 120_000;
        if (!canUndo) throw new Error("O prazo para desfazer essa baixa terminou ou a retirada foi registrada por outra pessoa.");
        if (!canUpdateOrderAsStaff(context.user, "retirado")) throw new Error("Seu nível de acesso não permite desfazer a retirada.");
        const updated = await role.entities.Order.update(order.id, {
          status: "pronto",
          pickup_qr_redeemed_at: "",
          pickup_qr_redeemed_by: "",
          status_history: [...(order.status_history ?? []), {
            status: "pronto", date, by: context.user.full_name || context.user.email || "equipe",
            note: "Registro de retirada pelo QR Code desfeito.",
          }],
          last_action_by: context.user.full_name || context.user.email || "equipe",
          last_action_email: context.user.email || "",
          last_action_at: date,
        });
        return { state: "undone", order: summary(updated) };
      }

      if (order.status === "retirado") {
        const undoAvailable = order.pickup_qr_redeemed_by === context.user.id
          && Date.now() - Date.parse(order.pickup_qr_redeemed_at || "") <= 120_000;
        return { state: "already_retired", order: summary(order), undo_available: undoAvailable };
      }
      if (order.fulfillment !== "retirada" || order.status !== "pronto") {
        return { state: "not_ready", order: summary(order), message: "Este pedido ainda não está pronto para retirada na loja." };
      }
      const collectAtPickup = order.fulfillment === "retirada"
        && order.payment_status === "pendente"
        && (awaitsPickupPayment(order) || order.payment_method === STORE_PAYMENT);
      if (order.payment_status !== "aprovado" && !collectAtPickup) {
        return { state: "payment_pending", order: summary(order), message: "Confirme o recebimento do pagamento antes de registrar a retirada." };
      }
      if (needsArtApproval(order)) {
        return { state: "approval_pending", order: summary(order), message: "A aprovação da arte ainda precisa ser registrada antes da retirada." };
      }

      if (behavior === "consultar") return { state: "view_only", order: summary(order) };
      if (collectAtPickup && data.action !== "confirm") {
        return { state: "collect_payment", order: summary(order), message: "Confirme que recebeu o pagamento no balcão para registrar a retirada." };
      }
      if (behavior === "confirmar" && data.action !== "confirm") {
        return { state: "confirmation_required", order: summary(order) };
      }
      if (behavior === "automatico" && data.action === "confirm" && !collectAtPickup) {
        return { state: "confirmation_required", order: summary(order) };
      }
      if (!canUpdateOrderAsStaff(context.user, "retirado")) throw new Error("Seu nível de acesso não pode registrar a retirada por QR Code.");
      if (collectAtPickup && !canUpdateOrderAsStaff(context.user, "pagamento_aprovado")) {
        throw new Error("Seu nível de acesso não permite confirmar o recebimento no balcão.");
      }
      if (collectAtPickup) {
        await lockCampaigns(db);
        if (order.coupon_pay_by) checkCouponPaymentDeadline(order);
      }

      const updated = await role.entities.Order.update(order.id, {
        status: "retirado",
        ...(collectAtPickup ? { payment_status: "aprovado", payment_approved_at: date } : {}),
        pickup_qr_redeemed_at: date,
        pickup_qr_redeemed_by: context.user.id,
        status_history: [...(order.status_history ?? []), ...(collectAtPickup ? [{
          status: "pagamento_aprovado", date, by: context.user.full_name || context.user.email || "equipe",
          note: "Pagamento recebido no balcão durante a retirada por QR Code.",
        }] : []), {
          status: "retirado", date, by: context.user.full_name || context.user.email || "equipe",
          note: "Retirada registrada pela leitura do QR Code.",
        }],
        last_action_by: context.user.full_name || context.user.email || "equipe",
        last_action_email: context.user.email || "",
        last_action_at: date,
      });
      if (collectAtPickup) await enqueueOrderNotice(db, order.id, "payment_approved");
      await enqueueOrderNotice(db, order.id, "shipped");
      return { state: "retired", order: summary(updated), payment_collected: collectAtPickup, undo_available: true };
    });
    if (["retired", "undone"].includes(result.state)) {
      void sendPendingOrderNotices(context.getBase44()).catch(() => {});
    }
    return result;
  });
