import { createFileRoute } from "@tanstack/react-router";
import { listRestoreBackups } from "@/lib/backup.server";

export const Route = createFileRoute("/api/admin/backups")({
  server: {
    handlers: {
      GET: async ({ context }) => {
        if (context.user?.role !== "admin") return Response.json({ error: "Acesso restrito." }, { status: 403 });
        try { return Response.json({ backups: await listRestoreBackups() }, { headers: { "cache-control": "no-store" } }); }
        catch (error) { return Response.json({ error: error.message || "Não foi possível listar os backups." }, { status: 500 }); }
      },
    },
  },
});
