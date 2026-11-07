const HEIC_PATTERN = /heic|heif/i;

export function isHeicFile(file) {
  return HEIC_PATTERN.test(file?.type || "") || /\.(heic|heif)$/i.test(file?.name || "");
}

/**
 * O navegador não abre HEIC (formato padrão do iPhone): a foto é convertida
 * para JPEG antes do envio. A biblioteca só é carregada quando existe alguma
 * foto HEIC na seleção, para não pesar o estúdio.
 */
export async function convertHeicToJpeg(file) {
  const { default: heic2any } = await import("heic2any");
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(result) ? result[0] : result;
  const name = String(file.name || "foto").replace(/\.(heic|heif)$/i, ".jpg");
  return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified || Date.now() });
}