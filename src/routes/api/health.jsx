import { createFileRoute } from "@tanstack/react-router";
import { ensureDatabase, getPool } from "@/lib/vps/db.server";

export const Route = createFileRoute("/api/health")({
  server: { handlers: { GET: async () => {
    try {
      await ensureDatabase();
      await getPool().query("SELECT 1");
      return Response.json({ ok: true, service: "paracolor-vps" }, { headers: { "cache-control": "no-store" } });
    } catch {
      return Response.json({ ok: false, service: "paracolor-vps" }, { status: 503, headers: { "cache-control": "no-store" } });
    }
  } } },
});
