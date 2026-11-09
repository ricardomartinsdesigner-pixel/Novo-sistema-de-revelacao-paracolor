import { createFileRoute } from "@tanstack/react-router";
import { serveFile } from "@/lib/vps/files.server";

export const Route = createFileRoute("/api/files/$id")({
  server: { handlers: { GET: ({ request, params, context }) => serveFile(request, params.id, context.user) } },
});
