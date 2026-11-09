export const PHOTO_COLOR_EFFECTS = {
  original: { label: "Original", filter: "none" },
  grayscale: {
    label: "Preto e branco",
    filter: "grayscale(1)",
    matrix: [
      [0.2126, 0.7152, 0.0722],
      [0.2126, 0.7152, 0.0722],
      [0.2126, 0.7152, 0.0722],
    ],
  },
  sepia: {
    label: "Sépia",
    filter: "sepia(1)",
    matrix: [
      [0.393, 0.769, 0.189],
      [0.349, 0.686, 0.168],
      [0.272, 0.534, 0.131],
    ],
  },
};

export function photoColorEffect(value) {
  return Object.hasOwn(PHOTO_COLOR_EFFECTS, value) ? value : "original";
}

export function photoColorFilter(value) {
  return PHOTO_COLOR_EFFECTS[photoColorEffect(value)].filter;
}

// Equivalente aos filtros CSS para navegadores sem CanvasRenderingContext2D.filter.
export function applyPhotoColorPixels(pixels, matrix) {
  const [red, green, blue] = matrix;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    pixels[offset] = red[0] * r + red[1] * g + red[2] * b;
    pixels[offset + 1] = green[0] * r + green[1] * g + green[2] * b;
    pixels[offset + 2] = blue[0] * r + blue[1] * g + blue[2] * b;
  }
}
