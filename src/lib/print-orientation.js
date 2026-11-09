export function detectImageOrientation(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0) || !(h > 0)) return "unknown";
  if (Math.abs(w - h) <= Math.max(w, h) * 0.01) return "square";
  return w > h ? "landscape" : "portrait";
}

export function orientPrintDimensions(widthCm, heightCm, sourceOrientation) {
  let width = Number(widthCm) || 10;
  let height = Number(heightCm) || 15;

  if (sourceOrientation === "landscape" && width < height) [width, height] = [height, width];
  if (sourceOrientation === "portrait" && width > height) [width, height] = [height, width];

  return {
    widthCm: width,
    heightCm: height,
    orientation: detectImageOrientation(width, height),
  };
}

export function printDimensionsForSize(size, sourceOrientation = "unknown") {
  const cutWidth = Number(size?.print_width_cm);
  const cutHeight = Number(size?.print_height_cm);
  const hasCompleteCut = cutWidth > 0 && cutHeight > 0;
  const width = hasCompleteCut ? cutWidth : Number(size?.width_cm) || 10;
  const height = hasCompleteCut ? cutHeight : Number(size?.height_cm) || 15;
  return orientPrintDimensions(width, height, sourceOrientation);
}
