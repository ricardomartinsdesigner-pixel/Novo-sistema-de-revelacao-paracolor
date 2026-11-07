import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const normalize = (value) => String(value || "").trim();

// Consulta pública: o cliente informa o número do pedido e o e-mail usado na
// compra e recebe só o andamento. O e-mail é a prova de posse do pedido.
export const lookupOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      order_number: z.string().min(4).max(80),
      email: z.string().min(5).max(160),
    })
  )
  .handler(async ({ data, context }) => {
    const role = context.getBase44().asServiceRole;
    const number = normalize(data.order_number).toUpperCase();
    const email = normalize(data.email).toLowerCase();
    const page = await role.entities.Order.filter({ order_number: number }, { limit: 5 });
    const order = (page.items ?? []).find(
      (item) => normalize(item.customer_email).toLowerCase() === email
    );
    if (!order) return { found: false };

    const items = await role.entities.OrderItem.filter({ order_id: order.id }, { limit: 100 });
    return {
      found: true,
      order: {
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        fulfillment: order.fulfillment,
        shipping_label: order.shipping_label || "",
        created_date: order.created_date,
        production_days: order.production_days || 0,
        total: order.total || 0,
        status_history: order.status_history ?? [],
        items: (items.items ?? []).map((item) => ({
          product_name: item.product_name,
          variant: item.variant,
          qty: item.qty,
          photo_count: item.photo_count,
          line_total: item.line_total,
        })),
      },
    };
  });