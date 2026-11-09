import { convertHeicToJpeg, isHeicFile } from "@/lib/heic";
import { normalizeExifOrientation } from "@/lib/image-orientation";

// Formatos de foto aceitos em toda a loja. HEIC/HEIF usa o decodificador do
// navegador quando disponível e cai para conversão em JPG quando necessário.
export const PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif";

// Artes (banners, personalizados e PDFs prontos para impressão).
export const ART_ACCEPT = `${PHOTO_ACCEPT},application/pdf,.pdf`;

export { isHeicFile };

export function isPdfFile(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

/**
 * Prepara a seleção do cliente: normaliza a orientação EXIF e converte HEIC/HEIF
 * para JPG. `heicFailed` conta os arquivos HEIC que não puderam ser lidos.
 */
export async function prepareUploads(files) {
  const prepared = [];
  let heicFailed = 0;
  for (const file of files) {
    if (isHeicFile(file)) {
      try {
        // Prefer browser-native orientation metadata when it can decode HEIC.
        // Otherwise, the existing converter produces a browser-readable JPEG.
        const normalized = await normalizeExifOrientation(file, { outputType: "image/jpeg", force: true });
        const converted = normalized === file ? await convertHeicToJpeg(file) : normalized;
        prepared.push(await normalizeExifOrientation(converted));
      } catch {
        heicFailed += 1;
      }
      continue;
    }
    prepared.push(await normalizeExifOrientation(file));
  }
  return { files: prepared, heicFailed };
}
