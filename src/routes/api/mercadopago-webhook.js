import { applyMercadoPago, lookupMercadoPago } from "@/lib/mercadopago-reconcile.server";
import { createFileRoute } from "@tanstack/react-router";
import { getMercadoPagoToken, getMercadoPagoWebhookSecret } from "@/lib/integrations.server";
import { verifyMercadoPagoSignature } from "@/lib/mercadopago-webhook.server";

export const Route = createFileRoute("/api/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const token = await getMercadoPagoToken(context.getBase44(), { includeDisabled: true });
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

        if (!/^\d+$/.test(String(paymentId))) return Response.json({ ok: false }, { status: 400 });
        try {
          const payment = await lookupMercadoPago(`https://api.mercadopago.com/v1/payments/${paymentId}`, token);
          return Response.json(await applyMercadoPago(context.getBase44(), payment, token));
        } catch {
          return Response.json({ ok: false, reason: "payment_lookup_failed" }, { status: 500 });
        }
      },
    },
  },
});
