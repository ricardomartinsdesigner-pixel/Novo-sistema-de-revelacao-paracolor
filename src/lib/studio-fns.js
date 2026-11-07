import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function sniff(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  const header = String.fromCharCode(...Array.from(bytes.slice(0, 12)));
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") return "image/webp";
  return "";
}

/**
 * Confere no servidor o arquivo que o painel acabou de enviar para o storage:
 * tipo real (pelos bytes iniciais), tamanho e legibilidade. Só administradores
 * publicam fotos do site.
 */
export const checkUploadedImage = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ url: z.string().min(8).max(2000) }))
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") {
      throw Object.assign(new Error("Apenas administradores podem publicar fotos."), { status: 403 });
    }
    let fileUrl;
    try {
      const requestUrl = new URL(getRequest().url);
      fileUrl = new URL(data.url, requestUrl);
      if (fileUrl.origin !== requestUrl.origin || !fileUrl.pathname.startsWith("/api/files/")) return { ok: false, error: "O arquivo precisa ter sido enviado para o armazenamento da loja." };
    } catch {
      return { ok: false, error: "O endereço do arquivo é inválido." };
    }
    const response = await fetch(fileUrl, { headers: { Range: "bytes=0-4095" } });
    if (!response.ok) return { ok: false, error: "Não conseguimos ler o arquivo enviado." };

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const realType = sniff(bytes);
    if (!realType) return { ok: false, error: "O arquivo não é uma imagem PNG, JPG ou WEBP." };

    const range = response.headers.get("content-range") || "";
    const total = Number(range.split("/")[1] || response.headers.get("content-length") || 0);
    if (total && total > MAX_BYTES) {
      return { ok: false, error: "A imagem passa de 8 MB. Envie uma versão menor." };
    }

    const declared = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (declared && !ALLOWED.has(declared)) {
      return { ok: false, error: "O arquivo enviado não é uma imagem aceita." };
    }

    return { ok: true, contentType: realType, bytes: total };
  });
