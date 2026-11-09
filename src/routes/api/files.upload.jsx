import { createFileRoute } from "@tanstack/react-router";
import { saveUploadedFile } from "@/lib/vps/files.server";
import { userFromRequest } from "@/lib/vps/session.server";
import { isAllowedRequestOrigin } from "@/lib/request-origin";

export const Route = createFileRoute("/api/files/upload")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const origin = request.headers.get("origin");
      if (origin && !isAllowedRequestOrigin(request, origin, process.env.PUBLIC_APP_URL || "")) return Response.json({ error: "Origem inválida." }, { status: 403 });
      const user = await userFromRequest(request);
      if (!user) return Response.json({ error: "Faça login para enviar arquivos." }, { status: 401 });
      const form = await request.formData();
      const file = form.get("file");
      const visibility = form.get("visibility") === "public" ? "public" : "private";
      return Response.json(await saveUploadedFile(file, user, visibility));
    } catch (error) { return Response.json({ error: error.message || "Falha no envio." }, { status: error.status || 400 }); }
  } } },
});
