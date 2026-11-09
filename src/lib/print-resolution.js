export const PRINT_TARGET_PPI = 300;
export const PRINT_GOOD_PPI = 200;

export function maxPrintSize(width, height, ppi) {
  return [width, height].map((pixels) => Math.floor((pixels * 254) / (ppi * 10)) / 10);
}

export function resolutionLevel(ppi) {
  if (ppi >= PRINT_TARGET_PPI) return { level: "excelente", label: "Excelente" };
  if (ppi >= PRINT_GOOD_PPI) return { level: "adequada", label: "Adequada" };
  if (ppi >= 150) return { level: "baixa", label: "Baixa" };
  return { level: "insuficiente", label: "Insuficiente" };
}

export function printFillPpi(width, height, printWidthCm, printHeightCm) {
  const [shortPixels, longPixels] = [width, height].sort((a, b) => a - b);
  const [shortCm, longCm] = [printWidthCm, printHeightCm].sort((a, b) => a - b);
  return Math.floor(Math.min(shortPixels / shortCm, longPixels / longCm) * 2.54 + 1e-8);
}
