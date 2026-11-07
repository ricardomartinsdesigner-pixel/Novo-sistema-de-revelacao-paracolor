import { convertHeicToJpeg, isHeicFile } from "@/lib/heic";

// Formatos de foto aceitos em toda a loja. O HEIC/HEIF do iPhone é convertido
// para JPG antes do envio, porque o navegador não consegue abrir o arquivo.
export const PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif";

// Artes (banners, personalizados e PDFs prontos para impressão).
export const ART_ACCEPT = `${PHOTO_ACCEPT},application/pdf,.pdf`;

export { isHeicFile };

export function isPdfFile(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

/**
 * Prepara a seleção do cliente: converte HEIC/HEIF para JPG e mantém os demais
 * arquivos como estão. `heicFailed` conta as fotos que não puderam ser lidas.
 */
export async function prepareUploads(files) {
  const prepared = [];
  let heicFailed = 0;
  for (const file of files) {
    if (!isHeicFile(file)) {
      prepared.push(file);
      continue;
    }
    try {
      prepared.push(await convertHeicToJpeg(file));
    } catch {
      heicFailed += 1;
    }
  }
  return { files: prepared, heicFailed };
}