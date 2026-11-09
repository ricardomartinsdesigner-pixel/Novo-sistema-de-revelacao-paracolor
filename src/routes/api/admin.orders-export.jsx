import { createFileRoute } from "@tanstack/react-router";
import { OrderFilters } from "@/lib/admin-order-filters";
import { exportAdminOrders } from "@/lib/admin-orders.server";
import { csvRow } from "@/lib/admin-csv";
import { STATUS_LABELS, formatDate } from "@/lib/areas";
import { dateKey } from "@/lib/deadline";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { hasStaffAccess } from "@/lib/staff-access";

export const Route = createFileRoute("/api/admin/orders-export")({
  server: { handlers: { POST: async ({ request, context }) => {
    if (!context.user) return Response.json({ error: "Faça login para exportar os pedidos." }, { status: 401 });
    if (!hasStaffAccess(context.user, "orders")) return Response.json({ error: "Acesso restrito aos pedidos." }, { status: 403 });

    if (!isAllowedRequestOrigin(request, request.headers.get("origin"), process.env.PUBLIC_APP_URL || "")) {
      return Response.json({ error: "Origem inválida." }, { status: 403 });
    }

    const filters = OrderFilters.safeParse(await request.json().catch(() => null));
    if (!filters.success) return Response.json({ error: "Filtros inválidos." }, { status: 400 });

    const orders = await exportAdminOrders(filters.data);
    const header = ["Pedido site", "Número interno", "Data", "Cliente", "Email", "Status", "Pagamento", "Total"];
    const rows = orders.map((order) => csvRow([
      order.order_number, order.internal_number, formatDate(order.created_date), order.customer_name,
      order.customer_email, STATUS_LABELS[order.status] || order.status, order.payment_status,
      (Number(order.total) || 0).toFixed(2).replace(".", ","),
    ]));
    return new Response("\uFEFF" + [csvRow(header), ...rows].join("\r\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="pedidos_paracolor_${dateKey(new Date())}.csv"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } } },
});
