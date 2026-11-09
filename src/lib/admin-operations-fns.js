import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "./auth-middleware";
import { OrderFilters } from "./admin-order-filters";
import { countAdminOrderTabs, getPaymentTotals, getProductionStart, listAdminOrders, listOrderQueue, listUnreadOrderAlerts, markOrderAlertViewed } from "./admin-orders.server";
import { adminSales } from "./admin-sales.server";
import { hasStaffAccess } from "./staff-access";

function requireAccess(user, permission) {
  if (!hasStaffAccess(user, permission)) throw new Error("Seu nível de acesso não permite esta operação.");
}

export const getAdminOrders = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ filters: OrderFilters, offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0) }))
  .handler(({ data, context }) => {
    requireAccess(context.user, "orders");
    return listAdminOrders(data.filters, data.offset, context.user.id);
  });

export const getUnreadOrderAlerts = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(({ context }) => {
    requireAccess(context.user, "orders");
    return listUnreadOrderAlerts(context.user.id, 5);
  });

export const markOrderAlertAsViewed = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ order_id: z.string().min(1).max(120) }))
  .handler(({ data, context }) => {
    requireAccess(context.user, "orders");
    return markOrderAlertViewed(data.order_id, context.user);
  });

export const getAdminSales = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]), basis: z.enum(["pedido", "recebimento"]).default("pedido") }))
  .handler(({ data, context }) => {
    requireAccess(context.user, "reports");
    return adminSales(data.days, data.basis);
  });

export const getAdminOrderTabCounts = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(({ context }) => {
    requireAccess(context.user, "orders");
    return countAdminOrderTabs();
  });

export const getOrderQueue = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({
    queue: z.enum(["production", "deliveries", "payments"]),
    search: z.string().trim().max(120).default(""),
    offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
  }))
  .handler(({ data, context }) => {
    requireAccess(context.user, data.queue === "payments" ? "payments" : data.queue === "production" ? "production" : "deliveries");
    return listOrderQueue(data.queue, data.search, data.offset);
  });

export const getProductionStartOverview = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(({ context }) => {
    requireAccess(context.user, "orders");
    return getProductionStart(context.user.id);
  });

export const getAdminPaymentTotals = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(({ context }) => {
    requireAccess(context.user, "payments");
    return getPaymentTotals();
  });

const reportPeriod = z.union([
  z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]) }),
  z.object({ from: z.iso.date(), to: z.iso.date() }).refine(({ from, to }) => from <= to, "A data inicial precisa vir antes da data final."),
]);

export const getSalesReport = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({
    period: reportPeriod,
    basis: z.enum(["pedido", "recebimento"]),
    offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
    full: z.boolean().default(false),
  }))
  .handler(({ data, context }) => {
    requireAccess(context.user, "reports");
    return adminSales(data.period.days ?? 30, data.basis, {
      from: data.period.from, to: data.period.to, details: true, offset: data.full ? 0 : data.offset,
      limit: data.full ? null : 25,
    });
  });
