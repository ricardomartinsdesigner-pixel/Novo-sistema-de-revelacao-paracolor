import { createFileRoute } from "@tanstack/react-router";
import { signedFileUrl } from "@/lib/vps/files.server";
import { userFromRequest } from "@/lib/vps/session.server";

export const Route = createFileRoute("/api/files/sign")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const user = await userFromRequest(request);
      if (!user) return Response.json({ error: "Faça login para abrir este arquivo." }, { status: 401 });
      const { file_uri, expires_in } = await request.json();
      return Response.json(await signedFileUrl(file_uri, request, expires_in, user));
    } catch (error) { return Response.json({ error: error.message || "Arquivo não encontrado." }, { status: error.status || 400 }); }
  } } },
});
