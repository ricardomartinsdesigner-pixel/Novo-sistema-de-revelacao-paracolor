import { statfs } from "node:fs/promises";
import { createFileRoute } from "@tanstack/react-router";
import { listRestoreBackups } from "@/lib/backup.server";

export const Route = createFileRoute("/api/admin/diagnostico")({
  server: { handlers: {
    GET: async ({ context }) => {
      if (context.user?.role !== "admin") return Response.json({ error: "Acesso restrito." }, { status: 403 });
      const [disk, backups, retention] = await Promise.all([
        statfs(process.env.STORAGE_DIR || "./data/uploads").catch(() => statfs(process.cwd()).catch(() => null)),
        listRestoreBackups(),
        context.getBase44().asServiceRole.entities.RetentionRun.get("latest").catch(() => null),
      ]);
      return Response.json({
        version: process.env.APP_VERSION || "1.12.23",
        available: disk ? disk.bavail * disk.bsize : null,
        lastBackup: backups.automatic[0]?.created_at,
        retention,
      }, { headers: { "cache-control": "no-store" } });
    },
  } },
});
