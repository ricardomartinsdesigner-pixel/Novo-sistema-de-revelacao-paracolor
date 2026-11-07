import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import {
  createDownloadBackup,
  backupDirectory,
  downloadStoredBackup,
  receiveBackupUpload,
  restoreBackupFromUpload,
  setBackupDownloadHeaders,
} from "@/lib/backup.server";

function admin(context) {
  return context.user?.role === "admin";
}

export const Route = createFileRoute("/api/admin/backup")({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        if (!admin(context)) return Response.json({ error: "Apenas administradores podem acessar backups." }, { status: 403 });
        const storedName = new URL(request.url).searchParams.get("stored");
        if (storedName) {
          const filePath = await downloadStoredBackup(storedName);
          if (!filePath) return Response.json({ error: "Backup não encontrado." }, { status: 404 });
          return new Response(Readable.toWeb(createReadStream(filePath)), { headers: await setBackupDownloadHeaders(filePath, storedName) });
        }
        let result;
        try {
          result = await createDownloadBackup();
          const filename = result.archivePath.split(/[\\/]/).pop();
          const stream = createReadStream(result.archivePath);
          stream.once("close", () => rm(result.workDir, { recursive: true, force: true }).catch(() => {}));
          stream.once("error", () => rm(result.workDir, { recursive: true, force: true }).catch(() => {}));
          return new Response(Readable.toWeb(stream), { headers: await setBackupDownloadHeaders(result.archivePath, filename) });
        } catch (error) {
          if (result?.workDir) await rm(result.workDir, { recursive: true, force: true }).catch(() => {});
          return Response.json({ error: error.message || "Não foi possível criar o backup." }, { status: 500 });
        }
      },
      POST: async ({ request, context }) => {
        if (!admin(context)) return Response.json({ error: "Apenas administradores podem restaurar backups." }, { status: 403 });
        if (request.headers.get("x-paracolor-restore-confirmation") !== "RESTAURAR") {
          return Response.json({ error: "Confirme digitando RESTAURAR no painel." }, { status: 400 });
        }
        const declaredSize = Number(request.headers.get("content-length") || 0);
        const maxBytes = Number(process.env.MAX_BACKUP_MB || 10240) * 1024 * 1024;
        if (declaredSize > maxBytes) return Response.json({ error: "O arquivo excede o limite de upload configurado." }, { status: 413 });
        await mkdir(backupDirectory(), { recursive: true });
        const workDir = await mkdtemp(path.join(backupDirectory(), ".incoming-restore-"));
        const uploadPath = path.join(workDir, "incoming.tar.gz");
        try {
          await receiveBackupUpload(request, uploadPath);
          const result = await restoreBackupFromUpload(uploadPath, "RESTAURAR");
          return Response.json({ ok: true, ...result });
        } catch (error) {
          return Response.json({ error: error.message || "Não foi possível restaurar o backup." }, { status: 400 });
        } finally {
          await rm(workDir, { recursive: true, force: true }).catch(() => {});
        }
      },
    },
  },
});
