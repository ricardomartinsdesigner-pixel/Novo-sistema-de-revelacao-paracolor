import { createFileRoute } from "@tanstack/react-router";
import { entityRequest } from "@/lib/vps/entities.server";
import { userFromRequest } from "@/lib/vps/session.server";

export const Route = createFileRoute("/api/data")({
  server: { handlers: {
    POST: async ({ request }) => {
      try {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Origem inválida." }, { status: 403 });
        return Response.json(await entityRequest(request, await userFromRequest(request)));
      } catch (error) { return Response.json({ error: error.message || "Erro de dados." }, { status: error.status || 400 }); }
    },
  } },
});
