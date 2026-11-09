import { createFileRoute } from "@tanstack/react-router";
import { availableDraftFiles } from "@/lib/vps/files.server";
import { MAX_ORDER_PHOTOS } from "@/lib/photo-order";
import { isAllowedRequestOrigin } from "@/lib/request-origin";

export const Route = createFileRoute("/api/files/draft")({
  server: { handlers: { POST: async ({ request, context }) => {
    if (!context.user?.id) return Response.json({ error: "Faça login para continuar seu envio." }, { status: 401 });
    const origin = request.headers.get("origin");
    if (!isAllowedRequestOrigin(request, origin, process.env.PUBLIC_APP_URL || "")) return Response.json({ error: "Origem inválida." }, { status: 403 });
    const ids = await request.json().catch(() => null);
    if (!Array.isArray(ids) || ids.length > MAX_ORDER_PHOTOS || ids.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) {
      return Response.json({ error: "Referências inválidas." }, { status: 400 });
    }
    return Response.json(await availableDraftFiles(ids, context.user.id), { headers: { "cache-control": "no-store" } });
  } } },
});
