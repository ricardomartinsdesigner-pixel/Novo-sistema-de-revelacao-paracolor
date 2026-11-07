import { createFileRoute } from "@tanstack/react-router";
import { getMercadoPagoToken, getMercadoPagoWebhookSecret } from "@/lib/integrations.server";
import { verifyMercadoPagoSignature } from "@/lib/mercadopago-webhook.server";
import { notifyCustomer } from "@/lib/email.server";

export const Route = createFileRoute("/api/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const token = await getMercadoPagoToken(context.getBase44());
        const secret = await getMercadoPagoWebhookSecret(context.getBase44());
        if (!token || !secret) return Response.json({ ok: false, reason: "not_configured" }, { status: 503 });

        let payload = {};
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }

        if (payload?.type && payload.type !== "payment") return Response.json({ ok: true, ignored: true });

        const query = new URL(request.url).searchParams;
        const queryDataId = query.get("data.id");
        const paymentId = queryDataId ?? payload?.data?.id ?? payload?.id ?? null;
        if (!paymentId) return Response.json({ ok: true, ignored: true });

        const validSignature = verifyMercadoPagoSignature({
          secret,
          signature: request.headers.get("x-signature"),
          requestId: request.headers.get("x-request-id"),
          dataId: queryDataId ?? String(payload?.data?.id ?? ""),
        });
        if (!validSignature) return Response.json({ ok: false, reason: "invalid_signature" }, { status: 401 });

        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!response.ok) return Response.json({ ok: false, reason: "payment_lookup_failed" }, { status: 500 });

        const payment = await response.json();
        const testCredential = token.startsWith("TEST-");
        if (Boolean(payment.live_mode) === testCredential) return Response.json({ ok: false, reason: "credential_mode_mismatch" }, { status: 200 });
        const orderId = payment?.external_reference;
        if (!orderId) return Response.json({ ok: true, ignored: true });

        const role = context.getBase44().asServiceRole;
        let order;
        try {
          order = await role.entities.Order.get(orderId);
        } catch {
          return Response.json({ ok: false, reason: "order_not_found" }, { status: 200 });
        }

        if (payment.currency_id !== "BRL" || Math.round(Number(payment.transaction_amount) * 100) !== Math.round(Number(order.total) * 100)) return Response.json({ ok: false, reason: "amount_mismatch" }, { status: 200 });
        const approved = payment.status === "approved";
        const refunded = ["refunded", "charged_back"].includes(payment.status);
        if (order.payment_status === "aprovado" && !refunded) return Response.json({ ok: true, ignored: true });
        const rejected = ["rejected", "cancelled"].includes(payment.status);

        const patch = {
          payment_reference: String(payment.id ?? ""),
          payment_status: approved ? "aprovado" : refunded ? "reembolsado" : rejected ? "recusado" : "pendente",
        };

        if (approved && order.status === "aguardando_pagamento") {
          patch.status = "pagamento_aprovado";
          patch.status_history = [
            ...(order.status_history ?? []),
            {
              status: "pagamento_aprovado",
              date: new Date().toISOString(),
              by: "mercadopago",
              note: `Pagamento ${payment.status} · ${payment.payment_method_id ?? ""}`,
            },
          ];
        }

        await role.entities.Order.update(orderId, patch);
        if (approved) await notifyCustomer(context.getBase44(), { ...order, ...patch }, "payment_approved");
        return Response.json({ ok: true });
      },
    },
  },
});
