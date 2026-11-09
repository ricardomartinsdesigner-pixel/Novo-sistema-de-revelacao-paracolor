const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

function fileNameForType(name, mimeType) {
  const extension = EXTENSION_BY_MIME[mimeType];
  if (!extension) return name;
  const base = String(name || "foto").replace(/\.[^.]+$/, "") || "foto";
  return `${base}.${extension}`;
}

function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível normalizar a orientação da imagem."))),
      mimeType,
      mimeType === "image/jpeg" ? 0.98 : undefined
    );
  });
}

/**
 * Applies EXIF orientation to the pixels and removes the orientation metadata
 * from the normalized copy. The browser can then use the same orientation in
 * thumbnails, the crop editor and the final print canvas.
 */
export async function normalizeExifOrientation(file, { outputType, force = false } = {}) {
  if (!file || typeof createImageBitmap !== "function") return file;

  let value;
  try {
    const { orientation } = await import("exifr");
    value = await orientation(file);
  } catch {
    if (!force) return file;
  }
  if (!force && (!Number.isInteger(value) || value <= 1 || value > 8)) return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0);

    const requestedType = outputType || file.type || "image/jpeg";
    const blob = await canvasToBlob(canvas, requestedType);
    const mimeType = blob.type || requestedType;
    return new File([blob], fileNameForType(file.name, mimeType), {
      type: mimeType,
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file;
  } finally {
    bitmap.close?.();
  }
}
