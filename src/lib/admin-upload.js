import { base44 } from "@/api/base44Client";
import { checkUploadedImage } from "@/lib/studio-fns";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Envia uma foto do site e só devolve o endereço depois que o servidor confirma
 * o formato real e o tamanho. Formatos aceitos: PNG, JPG, JPEG e WEBP.
 */
export async function uploadSiteImage(file) {
  if (!ACCEPTED.includes(file.type)) throw new Error("Use uma imagem PNG, JPG ou WEBP.");
  if (file.size > MAX_BYTES) throw new Error("A imagem passa de 8 MB. Envie uma versão menor.");

  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
  const check = await checkUploadedImage({ data: { url: file_url } });
  if (!check?.ok) throw new Error(check?.error || "O arquivo enviado não é uma imagem válida.");

  return { url: file_url, bytes: check.bytes || file.size, type: check.contentType || file.type };
}

const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

/** Envia um vídeo do site para exibição pública (banner de divulgação). */
export async function uploadSiteVideo(file) {
  if (!VIDEO_TYPES.includes(file.type)) throw new Error("Use um vídeo MP4 ou WEBM.");
  if (file.size > MAX_VIDEO_BYTES) throw new Error("O vídeo passa de 40 MB. Envie uma versão menor.");

  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
  return { url: file_url };
}

export function fileSummary(file) {
  const kb = file.size / 1024;
  const size = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
  return `${file.type.replace("image/", "").toUpperCase()} · ${size}`;
}