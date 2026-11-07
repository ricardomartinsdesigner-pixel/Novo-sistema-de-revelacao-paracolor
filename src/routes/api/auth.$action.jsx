import { createFileRoute } from "@tanstack/react-router";
import { handleAuth } from "@/lib/vps/auth.server";
import { userFromRequest } from "@/lib/vps/session.server";

export const Route = createFileRoute("/api/auth/$action")({
  server: { handlers: {
    GET: async ({ request, params }) => handleAuth(request, params.action, await userFromRequest(request)),
    POST: async ({ request, params }) => {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Origem inválida." }, { status: 403 });
      return handleAuth(request, params.action, await userFromRequest(request));
    },
  } },
});
