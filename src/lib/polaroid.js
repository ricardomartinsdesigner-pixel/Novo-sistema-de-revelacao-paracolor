import { captionElement, captionFont } from "@/lib/caption-style";

// Geometria única da polaroide para prévia, recorte e impressão. A área da foto
// permanece quadrada; a faixa inferior serve apenas para a legenda.
export const POLAROID_MARGIN_X = 0.055;
export const POLAROID_MARGIN_TOP = 0.045;
export const POLAROID_GAP = 0.03;

export function polaroidGeometry(model, captionAreaEnabled = model?.has_caption !== false) {
  const width = Number(model?.width_cm) > 0 ? Number(model.width_cm) : 9;
  const height = Number(model?.height_cm) > 0 ? Number(model.height_cm) : 11;
  const marginX = width * POLAROID_MARGIN_X;
  const marginTop = height * POLAROID_MARGIN_TOP;
  // Foto quadrada: o lado é a largura do papel menos as duas margens laterais.
  const side = Math.max(1, width - marginX * 2);
  const gap = height * POLAROID_GAP;
  const caption = captionAreaEnabled ? Math.max(0, height - marginTop - side - gap) : 0;
  const photoHeight = side;
  return { width, height, marginX, marginTop, side, photoHeight, gap, caption, captionAreaEnabled };
}

// Limites da escrita no arquivo de impressão: o desenho corta a legenda em três
// linhas e centraliza o bloco na área branca.
export const CAPTION_MAX_LINES = 3;
export const CAPTION_LINE_HEIGHT = 1.25;
export const CAPTION_MIN_SIZE = 0.03;

// Mede a legenda com a mesma fonte, tamanho e largura do arquivo de impressão,
// para avisar antes de o texto ser cortado.
export function measureCaption(photo, model) {
  const style = photo?.captionStyle || {};
  const caption = String(photo?.caption || "").trim();
  const geo = polaroidGeometry(model ?? { width_cm: photo?.wCm, height_cm: photo?.hCm });
  const unitW = 1000;
  const unitH = (geo.height / geo.width) * unitW;
  const size = unitW * (style.size ?? 0.062);
  const maxWidth = unitW - (geo.marginX / geo.width) * unitW * 2;
  const areaHeight = (geo.caption / geo.height) * unitH;
  const glyph = captionElement(style);
  const lineHeight = size * CAPTION_LINE_HEIGHT;
  const glyphHeight = glyph ? lineHeight * 0.9 : 0;

  let lineCount = 0;
  if (caption) {
    if (typeof document !== "undefined") {
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `${style.bold ? "600 " : ""}${size}px ${captionFont(style)}`;
      let line = "";
      caption.split(/\s+/).forEach((word) => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lineCount += 1;
          line = word;
        } else {
          line = test;
        }
      });
      if (line) lineCount += 1;
    } else {
      lineCount = Math.ceil(caption.length / 24);
    }
  }

  const textHeight = lineCount * lineHeight + glyphHeight;
  const truncated = Math.max(0, lineCount - CAPTION_MAX_LINES);
  return {
    lineCount,
    maxLines: CAPTION_MAX_LINES,
    truncated,
    tooTall: textHeight > areaHeight,
    fits: caption.length > 0 && truncated === 0 && textHeight <= areaHeight,
  };
}

// Maior tamanho de fonte que deixa a legenda inteira dentro da área branca.
export function fitCaptionSize(photo, model) {
  const style = photo?.captionStyle || {};
  let size = Number(style.size ?? 0.062);
  while (size > CAPTION_MIN_SIZE) {
    if (measureCaption({ ...photo, captionStyle: { ...style, size } }, model).fits) break;
    size -= 0.002;
  }
  return Number(Math.max(CAPTION_MIN_SIZE, size).toFixed(3));
}

// Frações do papel, para as prévias em HTML.
export function polaroidRatios(model, captionAreaEnabled = model?.has_caption !== false) {
  const geo = polaroidGeometry(model, captionAreaEnabled);
  return {
    left: geo.marginX / geo.width,
    top: geo.marginTop / geo.height,
    photoW: geo.side / geo.width,
    photoH: geo.photoHeight / geo.height,
    gap: geo.gap / geo.height,
    caption: geo.caption / geo.height,
  };
}
