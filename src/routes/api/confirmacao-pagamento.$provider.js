import { createFileRoute } from "@tanstack/react-router";
import { paymentCallbackAuthorized, processPaymentCallback } from "@/lib/payment-attempts.server";
import { securityKeyConfigured } from "@/lib/security-secrets.server";

export const Route = createFileRoute("/api/confirmacao-pagamento/$provider")({
  server: { handlers: { POST: async ({ request, params, context }) => {
    if (!["infinitepay", "pagarme"].includes(params.provider) || !securityKeyConfigured()) return new Response(null, { status: 404 });
    const search = new URL(request.url).searchParams;
    if (!paymentCallbackAuthorized(params.provider, search)) return new Response(null, { status: 401 });
    if (Number(request.headers.get("content-length")) > 128 * 1024) return new Response(null, { status: 413 });
    try {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return new Response(null, { status: 400 });
      const status = await processPaymentCallback(context.getBase44(), params.provider, body, search);
      return new Response(null, { status });
    } catch { return new Response(null, { status: 503 }); }
  } } },
});
