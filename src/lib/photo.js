import { captionElement, captionFont, ensureCaptionFont } from "@/lib/caption-style";
import { polaroidGeometry } from "@/lib/polaroid";

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível abrir esta imagem."));
    image.src = src;
  });
}

export function computeLayout({ imgW, imgH, w, h, aspect, zoom = 1, rotation = 0, fit = "cover" }) {
  const iw = Number(imgW ?? w) || 1;
  const ih = Number(imgH ?? h) || 1;
  const frameW = 1;
  const frameH = 1 / (Number(aspect) > 0 ? Number(aspect) : 1);
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  // Dimensões do quadro medidas nos eixos da própria imagem: escala mínima para
  // a imagem girada cobrir o quadro em qualquer ângulo.
  const coverW = frameW * cos + frameH * sin;
  const coverH = frameW * sin + frameH * cos;
  // Caixa que a imagem ocupa depois de girada.
  const boxW = iw * cos + ih * sin;
  const boxH = iw * sin + ih * cos;
  const base = fit === "contain" ? Math.min(frameW / boxW, frameH / boxH) : Math.max(coverW / iw, coverH / ih);
  const scale = base * zoom;
  return {
    frameW,
    frameH,
    scale,
    drawW: iw * scale,
    drawH: ih * scale,
    effW: boxW * scale,
    effH: boxH * scale,
  };
}

export function innerFrame(aspect, border) {
  const safeAspect = Number(aspect) > 0 ? Number(aspect) : 1;
  const height = 1 / safeAspect;
  // A borda branca é 4,5% do lado menor — exatamente como no arquivo de impressão.
  const inset = border ? 0.045 * Math.min(1, height) : 0;
  return { fw: 1 - inset * 2, fh: height - inset * 2, inset };
}

/**
 * Proporção da área que recebe a foto: o formato impresso já sem a borda branca.
 * Prévia, arraste, avisos e arquivo final partem sempre desta mesma medida.
 */
export function printAspect(photo) {
  const { fw, fh } = innerFrame(photo?.aspect, photo?.border);
  return fw > 0 && fh > 0 ? fw / fh : 1;
}

export function maxOffsets(photo) {
  if (photo.fit === "contain") return { maxX: 0, maxY: 0 };
  const layout = computeLayout({ ...photo, aspect: printAspect(photo) });
  const rad = ((photo.rotation || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const halfW = layout.frameW / 2;
  const halfH = layout.frameH / 2;
  const limit = (room, divisor) => (divisor > 1e-6 ? room / divisor : Infinity);
  // Quanto o quadro pode andar até algum canto encostar na borda da imagem girada.
  const maxX = Math.min(
    limit(layout.drawW / 2 - halfW * cos - halfH * sin, cos),
    limit(layout.drawH / 2 - halfW * sin - halfH * cos, sin)
  );
  const maxY = Math.min(
    limit(layout.drawH / 2 - halfH * cos - halfW * sin, cos),
    limit(layout.drawW / 2 - halfH * sin - halfW * cos, sin)
  );
  return { maxX: Math.max(0, maxX), maxY: Math.max(0, maxY) };
}

export function clampPhoto(photo) {
  const { maxX, maxY } = maxOffsets(photo);
  // Um limite inválido nunca deve virar deslocamento NaN: isso apagaria a prévia
  // e travaria o arraste. Sem limite confiável, a foto fica centralizada.
  const clamp = (value, limit) => {
    const bound = Number.isFinite(limit) ? Math.abs(limit) : 0;
    const next = Number.isFinite(Number(value)) ? Number(value) : 0;
    return Math.max(-bound, Math.min(bound, next));
  };
  return { ...photo, ox: clamp(photo.ox, maxX), oy: clamp(photo.oy, maxY) };
}

export function qualityFor(photo) {
  const printW = photo.printW || photo.wCm;
  const printH = photo.printH || photo.hCm;
  if (!photo.w || !photo.h || !printW || !printH) return { level: "adequada", dpi: 0, label: "Adequada" };
  const dpiW = photo.w / (printW / 2.54);
  const dpiH = photo.h / (printH / 2.54);
  const dpi = Math.round(Math.min(dpiW, dpiH));
  if (dpi >= 300) return { level: "excelente", dpi, label: "Excelente" };
  if (dpi >= 200) return { level: "adequada", dpi, label: "Adequada" };
  if (dpi >= 150) return { level: "baixa", dpi, label: "Baixa" };
  return { level: "insuficiente", dpi, label: "Insuficiente" };
}

// Região do arquivo original que aparece impressa, já considerando o giro
// livre: cada canto do quadro é levado de volta para as coordenadas da imagem.
export function visibleRect(photo) {
  const layout = computeLayout({ ...photo, aspect: printAspect(photo) });
  const fw = layout.frameW;
  const fh = layout.frameH;
  const rad = ((photo.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const centerX = fw / 2 + (photo.ox || 0) * fw;
  const centerY = fh / 2 + (photo.oy || 0) * fh;
  const us = [];
  const vs = [];
  [[0, 0], [fw, 0], [0, fh], [fw, fh]].forEach(([x, y]) => {
    const dx = x - centerX;
    const dy = y - centerY;
    us.push(0.5 + (dx * cos + dy * sin) / layout.drawW);
    vs.push(0.5 + (-dx * sin + dy * cos) / layout.drawH);
  });
  const x = Math.max(0, Math.min(...us));
  const y = Math.max(0, Math.min(...vs));
  return {
    x,
    y,
    w: Math.min(1, Math.max(...us)) - x,
    h: Math.min(1, Math.max(...vs)) - y,
  };
}

function contains(rect, box, tolerance = 0.012) {
  return (
    box.x >= rect.x - tolerance &&
    box.y >= rect.y - tolerance &&
    box.x + box.w <= rect.x + rect.w + tolerance &&
    box.y + box.h <= rect.y + rect.h + tolerance
  );
}

export function evaluatePhoto(photo) {
  const quality = qualityFor(photo);
  const alerts = [];
  const analysis = photo.analysis;
  if (analysis) {
    const rect = visibleRect(photo);
    if (analysis.face && !contains(rect, analysis.face)) alerts.push("rosto_cortado");
    if (analysis.subject && !contains(rect, analysis.subject)) alerts.push("assunto_cortado");
  }
  if (quality.level === "insuficiente") alerts.push("resolucao_insuficiente");
  else if (quality.level === "baixa") alerts.push("resolucao_baixa");
  return { quality: quality.level, dpi: quality.dpi, alerts };
}

export const ALERT_LABELS = {
  rosto_cortado: "Possível rosto/cabeça cortado",
  assunto_cortado: "Assunto principal cortado nas bordas",
  resolucao_insuficiente: "Resolução insuficiente para este tamanho",
  resolucao_baixa: "Resolução baixa para este tamanho",
};

export function autoCorrect(photo) {
  if (!photo.analysis) return photo;
  const subject = photo.analysis.face || photo.analysis.subject;
  if (!subject) return photo;
  const aspect = printAspect(photo);
  let next = { ...photo, zoom: 1, ox: 0, oy: 0 };
  let layout = computeLayout({ ...next, aspect });
  const fw = layout.frameW;
  const fh = layout.frameH;
  let rad = ((next.rotation || 0) * Math.PI) / 180;
  const measure = () => {
    const subjectW = subject.w * layout.drawW;
    const subjectH = subject.h * layout.drawH;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    return { w: subjectW * cos + subjectH * sin, h: subjectW * sin + subjectH * cos };
  };
  let box = measure();
  const fits = box.w <= fw * 0.94 && box.h <= fh * 0.94;

  if (!fits && photo.fit === "cover") {
    next = { ...next, fit: "contain" };
    layout = computeLayout({ ...next, aspect });
    rad = ((next.rotation || 0) * Math.PI) / 180;
    box = measure();
  }

  // Vetor do centro da imagem até o assunto, no espaço do arquivo, girado para o quadro.
  const dx = (subject.x + subject.w / 2 - 0.5) * layout.drawW;
  const dy = (subject.y + subject.h / 2 - 0.5) * layout.drawH;
  const ox = -(dx * Math.cos(rad) - dy * Math.sin(rad)) / fw;
  const oy = -(dx * Math.sin(rad) + dy * Math.cos(rad)) / fh;
  return clampPhoto({ ...next, ox, oy });
}

export async function analyzeImage(image) {
  try {
    const W = 180;
    const H = Math.max(1, Math.round((W * image.naturalHeight) / image.naturalWidth));
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
    }
    const pixels = W * H;
    const mr = rSum / pixels;
    const mg = gSum / pixels;
    const mb = bSum / pixels;

    const scores = new Float32Array(pixels);
    const skin = [];
    for (let p = 0; p < pixels; p += 1) {
      const i = p * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      scores[p] = Math.abs(r - mr) + Math.abs(g - mg) + Math.abs(b - mb);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const looksSkin =
        r > 95 && g > 40 && b > 20 && max - min > 15 && Math.abs(r - g) > 15 && r > g && r > b && g > b * 0.7;
      if (looksSkin && p < pixels * 0.72) skin.push(p);
    }

    const sorted = Array.from(scores).sort((a, b) => a - b);
    const threshold = sorted[Math.floor(sorted.length * 0.82)] || 0;

    let sx = 0;
    let sy = 0;
    let sw = 0;
    let sh = 0;
    let count = 0;
    for (let p = 0; p < pixels; p += 1) {
      if (scores[p] >= threshold && threshold > 0) {
        const x = p % W;
        const y = Math.floor(p / W);
        sx += x;
        sy += y;
        count += 1;
      }
    }
    let subject = null;
    if (count > 0) {
      const cx = sx / count;
      const cy = sy / count;
      let minX = W;
      let minY = H;
      let maxX = 0;
      let maxY = 0;
      for (let p = 0; p < pixels; p += 1) {
        if (scores[p] >= threshold && threshold > 0) {
          const x = p % W;
          const y = Math.floor(p / W);
          if (Math.abs(x - cx) < W * 0.42 && Math.abs(y - cy) < H * 0.42) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
      if (maxX > minX && maxY > minY) {
        subject = {
          x: minX / W,
          y: minY / H,
          w: (maxX - minX) / W,
          h: (maxY - minY) / H,
        };
      }
    }

    let face = null;
    if (skin.length > pixels * 0.008) {
      let minX = W;
      let minY = H;
      let maxX = 0;
      let maxY = 0;
      skin.forEach((p) => {
        const x = p % W;
        const y = Math.floor(p / W);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
      if (maxX > minX && maxY > minY) {
        face = {
          x: Math.max(0, minX / W - 0.03),
          y: Math.max(0, minY / H - 0.03),
          w: Math.min(1, (maxX - minX) / W + 0.06),
          h: Math.min(1, (maxY - minY) / H + 0.06),
        };
      }
    }

    return { subject, face };
  } catch {
    return { subject: null, face: null };
  }
}

// Limite seguro de canvas: acima disso o celular não consegue gerar o arquivo.
const MAX_CANVAS_PIXELS = 15_000_000;

export function targetPixels(cm, dpi = 300) {
  return Math.min(4200, Math.max(120, Math.round((cm / 2.54) * dpi)));
}

function outputSize(widthCm, heightCm, dpi) {
  let outW = targetPixels(widthCm, dpi);
  let outH = targetPixels(heightCm, dpi);
  const area = outW * outH;
  if (area > MAX_CANVAS_PIXELS) {
    const factor = Math.sqrt(MAX_CANVAS_PIXELS / area);
    outW = Math.max(120, Math.round(outW * factor));
    outH = Math.max(120, Math.round(outH * factor));
  }
  return { outW, outH };
}

/**
 * Área realmente impressa do tamanho: o corte real, quando cadastrado,
 * e a resolução de saída. Sem corte real cadastrado, usa a medida comercial.
 */
export function sizePrintInfo(size) {
  const widthCm = Number(size?.print_width_cm) || Number(size?.width_cm) || 10;
  const heightCm = Number(size?.print_height_cm) || Number(size?.height_cm) || 15;
  const dpi = Number(size?.dpi) || 300;
  return { widthCm, heightCm, dpi };
}

export function drawPhoto(ctx, image, photo, outW, outH) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  const inset = photo.border ? Math.round(Math.min(outW, outH) * 0.045) : 0;
  const fw = outW - inset * 2;
  const fh = outH - inset * 2;
  const aspect = fw / fh;
  const layout = computeLayout({
    imgW: image.naturalWidth,
    imgH: image.naturalHeight,
    aspect,
    zoom: photo.zoom || 1,
    rotation: photo.rotation || 0,
    fit: photo.fit || "cover",
  });
  const scaleToPx = fw / layout.frameW;
  const drawW = layout.drawW * scaleToPx;
  const drawH = layout.drawH * scaleToPx;
  const cx = outW / 2 + (photo.ox || 0) * fw;
  const cy = outH / 2 + (photo.oy || 0) * fh;

  ctx.save();
  ctx.beginPath();
  ctx.rect(inset, inset, fw, fh);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(((photo.rotation || 0) * Math.PI) / 180);
  ctx.scale(photo.flipH ? -1 : 1, photo.flipV ? -1 : 1);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

export function drawPolaroid(ctx, image, photo, outW, outH, model) {
  const frameColor = model?.frame_color || "#ffffff";
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, outW, outH);

  // Área da foto sempre quadrada — a mesma medida usada na prévia e no recorte.
  const geo = polaroidGeometry(model ?? { width_cm: photo.wCm, height_cm: photo.hCm });
  const marginX = Math.round((geo.marginX / geo.width) * outW);
  const marginTop = Math.round((geo.marginTop / geo.height) * outH);
  const photoSide = Math.round((geo.side / geo.width) * outW);
  const gap = Math.round((geo.gap / geo.height) * outH);
  const captionArea = model?.has_caption === false ? 0 : Math.round((geo.caption / geo.height) * outH);

  const layout = computeLayout({
    imgW: image.naturalWidth,
    imgH: image.naturalHeight,
    aspect: 1,
    zoom: photo.zoom || 1,
    rotation: photo.rotation || 0,
    fit: photo.fit || "cover",
  });
  const scaleToPx = photoSide / layout.frameW;
  const drawW = layout.drawW * scaleToPx;
  const drawH = layout.drawH * scaleToPx;
  const cx = marginX + photoSide / 2 + (photo.ox || 0) * photoSide;
  const cy = marginTop + photoSide / 2 + (photo.oy || 0) * photoSide;

  ctx.save();
  ctx.beginPath();
  ctx.rect(marginX, marginTop, photoSide, photoSide);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(((photo.rotation || 0) * Math.PI) / 180);
  ctx.scale(photo.flipH ? -1 : 1, photo.flipV ? -1 : 1);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  const caption = (photo.caption || "").trim();
  if (caption && captionArea > 0) {
    const style = photo.captionStyle || {};
    const family = captionFont(style);
    const glyph = captionElement(style);
    const size = Math.round(outW * (style.size ?? 0.062));
    ctx.fillStyle = style.color || "#1A1614";
    ctx.textAlign = style.align === "left" ? "left" : style.align === "right" ? "right" : "center";
    ctx.textBaseline = "middle";
    ctx.font = `${style.bold ? "600 " : ""}${size}px ${family}`;
    const baseX =
      style.align === "left" ? marginX + outW * 0.02 : style.align === "right" ? outW - marginX - outW * 0.02 : outW / 2;
    const maxWidth = outW - marginX * 2;
    const words = caption.split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    const lineHeight = size * 1.25;
    const glyphHeight = glyph ? lineHeight * 0.9 : 0;
    const totalHeight = lines.length * lineHeight + glyphHeight;
    const blockTop = marginTop + photoSide + gap + (captionArea - totalHeight) / 2;
    if (glyph) {
      ctx.font = `${Math.round(size * 0.8)}px ${family}`;
      ctx.fillText(glyph, baseX, blockTop + glyphHeight / 2, maxWidth);
      ctx.font = `${style.bold ? "600 " : ""}${size}px ${family}`;
    }
    const startY = blockTop + glyphHeight + lineHeight / 2;
    lines.slice(0, 3).forEach((text, index) => {
      ctx.fillText(text, baseX, startY + index * lineHeight, maxWidth);
    });
  }
}

export function photoAspectForPolaroid() {
  // Toda polaroide tem área de foto quadrada, em qualquer tamanho de papel.
  return 1;
}

export async function canvasFromPhoto(photo, image, model) {
  const widthCm = photo.wCm || 10;
  const heightCm = photo.hCm || 15;
  const dpi = Number(photo.dpi) || 300;
  const { outW, outH } = outputSize(widthCm, heightCm, dpi);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (photo.area === "polaroid") {
    await ensureCaptionFont(photo.captionStyle);
    drawPolaroid(ctx, image, photo, outW, outH, model);
  } else {
    drawPhoto(ctx, image, photo, outW, outH);
  }
  return canvas;
}

export function canvasToBlob(canvas, type = "image/jpeg", quality = 0.94) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Este formato é grande demais para o seu dispositivo gerar o arquivo. Tente um tamanho menor."));
    }, type, quality);
  });
}