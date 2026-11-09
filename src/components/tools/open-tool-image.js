import { convertHeicToJpeg, isHeicFile } from "@/lib/heic";
import { loadImage } from "@/lib/photo";

async function openImage(file) {
  const url = URL.createObjectURL(file);
  try {
    return { url, image: await loadImage(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

// Use the browser's own decoder first. The HEIC decoder is loaded only if needed.
export async function openToolImage(file) {
  try {
    return await openImage(file);
  } catch (error) {
    if (!isHeicFile(file)) throw error;
    return openImage(await convertHeicToJpeg(file));
  }
}
