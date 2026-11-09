// Geometry for the sticker sheet calculator. All packing decisions use integer micrometres.
export const MM_PER_INCH = 25.4;
const UM_PER_MM = 1000;
const EPSILON_UM = 0;

export const STICKER_SHEET_PROFILES = {
  A4: {
    id: "A4",
    label: "A4 — 22,5 × 32 cm",
    widthMm: 225.001662,
    heightMm: 320.001204,
    // Red-vector limits from the supplied PDF, rounded inward to 0.001 mm so no cut crosses the source boundary.
    allowed: { x: 17.502, y: 17.389, width: 189.998, height: 275.0 },
    // Black laser registration shapes from the same PDF, in millimetres from top-left.
    marks: [
      [10.001, 9.5, 19.999, 1.002], [9.5, 10.001, 0.999, 19.999],
      [195.001, 9.5, 19.999, 1.002], [214.499, 10.001, 1.002, 19.999],
      [10.001, 219.502, 4.999, 0.998], [9.5, 210.002, 0.999, 10.001],
      [9.5, 220.003, 0.999, 9.998], [210.002, 219.502, 4.998, 0.998],
      [214.499, 210.002, 1.002, 10.001], [214.499, 220.003, 1.002, 9.998],
    ],
  },
  A3: {
    id: "A3",
    label: "A3 — 32 × 45 cm",
    widthMm: 320.001204,
    heightMm: 449.999793,
    // Red-vector limits from the supplied PDF, rounded inward to 0.001 mm so no cut crosses the source boundary.
    allowed: { x: 17.502, y: 16.708, width: 284.997, height: 404.999 },
    marks: [
      [10.001, 9.5, 19.999, 0.999], [9.5, 10.001, 0.999, 19.999],
      [290.001, 9.5, 19.999, 0.999], [309.499, 10.001, 1.002, 19.999],
      [10.001, 219.498, 4.999, 1.002], [9.5, 210.002, 0.999, 9.997],
      [9.5, 219.999, 0.999, 10.002], [305.001, 219.498, 4.999, 1.002],
      [309.499, 210.002, 1.002, 9.997], [309.499, 219.999, 1.002, 10.002],
    ],
  },
};

const toUm = (value) => Math.round(Number(value) * UM_PER_MM);
const fromUm = (value) => value / UM_PER_MM;
const capacity = (span, item, gap) => Math.max(0, Math.floor((span + gap + EPSILON_UM) / (item + gap)));

function makeShelfCandidate(width, height, itemWidth, itemHeight, gap, allowRotation, transpose) {
  const boxWidth = transpose ? height : width;
  const boxHeight = transpose ? width : height;
  const normal = { w: itemWidth, h: itemHeight, rotated: transpose };
  const rotated = { w: itemHeight, h: itemWidth, rotated: !transpose };
  const normalRows = Math.floor((boxHeight + gap) / (normal.h + gap));
  const rotatedRows = allowRotation ? Math.floor((boxHeight + gap) / (rotated.h + gap)) : 0;
  const normalAcross = capacity(boxWidth, normal.w, gap);
  const rotatedAcross = allowRotation ? capacity(boxWidth, rotated.w, gap) : 0;
  if (!normalAcross && !rotatedAcross) return { count: 0, placements: [] };

  let bestCount = 0;
  let bestRows = { normal: 0, rotated: 0 };
  for (let nNormal = 0; nNormal <= normalRows; nNormal += 1) {
    const usedNormal = nNormal * (normal.h + gap);
    const nRotated = allowRotation
      ? Math.min(rotatedRows, Math.floor((boxHeight + gap - usedNormal) / (rotated.h + gap)))
      : 0;
    const count = nNormal * normalAcross + nRotated * rotatedAcross;
    if (count > bestCount) {
      bestCount = count;
      bestRows = { normal: nNormal, rotated: nRotated };
    }
  }
  const placements = [];
  let rowY = 0;
  for (const [rows, item, across] of [[bestRows.normal, normal, normalAcross], [bestRows.rotated, rotated, rotatedAcross]]) {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < across; column += 1) {
        const virtualX = column * (item.w + gap);
        const virtualY = rowY;
        const x = transpose ? virtualY : virtualX;
        const y = transpose ? virtualX : virtualY;
        const actualWidth = transpose ? item.h : item.w;
        const actualHeight = transpose ? item.w : item.h;
        placements.push({
          x: fromUm(x), y: fromUm(y),
          width: fromUm(actualWidth), height: fromUm(actualHeight), rotated: item.rotated,
        });
      }
      rowY += item.h + gap;
    }
  }
  return { count: bestCount, placements };
}

function packMaxRects(width, height, itemWidth, itemHeight, gap, allowRotation, scoreMode, maxCount) {
  const free = [{ x: 0, y: 0, w: width + gap, h: height + gap }];
  const placements = [];
  while (placements.length < maxCount && placements.length < 1400) {
    let best = null;
    for (const space of free) {
      const orientations = [{ realW: itemWidth, realH: itemHeight, rotated: false }];
      if (allowRotation && itemWidth !== itemHeight) orientations.push({ realW: itemHeight, realH: itemWidth, rotated: true });
      for (const direction of orientations) {
        const w = direction.realW + gap;
        const h = direction.realH + gap;
        if (w > space.w || h > space.h) continue;
        const shortSide = Math.min(space.w - w, space.h - h);
        const longSide = Math.max(space.w - w, space.h - h);
        const areaFit = space.w * space.h - w * h;
        const score = scoreMode === 0 ? [shortSide, longSide, areaFit]
          : scoreMode === 1 ? [longSide, shortSide, areaFit]
            : [areaFit, shortSide, longSide];
        if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && (score[1] < best.score[1] || (score[1] === best.score[1] && score[2] < best.score[2])))) {
          best = { x: space.x, y: space.y, w, h, ...direction, score };
        }
      }
    }
    if (!best) break;
    placements.push({ x: best.x, y: best.y, width: best.realW, height: best.realH, rotated: best.rotated });
    const next = [];
    for (const rect of free) {
      if (best.x >= rect.x + rect.w || best.x + best.w <= rect.x || best.y >= rect.y + rect.h || best.y + best.h <= rect.y) {
        next.push(rect);
        continue;
      }
      if (best.x > rect.x) next.push({ x: rect.x, y: rect.y, w: best.x - rect.x, h: rect.h });
      if (best.x + best.w < rect.x + rect.w) next.push({ x: best.x + best.w, y: rect.y, w: rect.x + rect.w - best.x - best.w, h: rect.h });
      if (best.y > rect.y) next.push({ x: rect.x, y: rect.y, w: rect.w, h: best.y - rect.y });
      if (best.y + best.h < rect.y + rect.h) next.push({ x: rect.x, y: best.y + best.h, w: rect.w, h: rect.y + rect.h - best.y - best.h });
    }
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const a = next[i]; const b = next[j];
        if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) { next.splice(i, 1); i -= 1; break; }
        if (b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h) { next.splice(j, 1); j -= 1; }
      }
    }
    free.splice(0, free.length, ...next.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 1200));
  }
  return { count: placements.length, placements };
}

export function validateStickerLayout(placements, widthMm, heightMm, gapMm = 0) {
  const width = toUm(widthMm); const height = toUm(heightMm); const gap = toUm(gapMm);
  const rects = placements.map((item) => ({ x: toUm(item.x), y: toUm(item.y), w: toUm(item.width), h: toUm(item.height) })).sort((a, b) => a.x - b.x || a.y - b.y);
  for (let i = 0; i < rects.length; i += 1) {
    const a = rects[i];
    if (a.x < 0 || a.y < 0 || a.x + a.w > width || a.y + a.h > height) return { valid: false, reason: `Adesivo ${i + 1} fora da área permitida.` };
    for (let j = i + 1; j < rects.length && rects[j].x < a.x + a.w + gap; j += 1) {
      const b = rects[j];
      const xGap = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0);
      const yGap = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
      const overlapsX = a.x < b.x + b.w && b.x < a.x + a.w;
      const overlapsY = a.y < b.y + b.h && b.y < a.y + a.h;
      const overlaps = overlapsX && overlapsY;
      if (overlaps) return { valid: false, reason: `Os adesivos ${i + 1} e ${j + 1} se sobrepõem.` };
      if (gap > 0 && xGap < gap && yGap < gap) return { valid: false, reason: `O espaçamento entre os adesivos ${i + 1} e ${j + 1} é menor que o configurado.` };
    }
  }
  return { valid: true, reason: "" };
}

export function calculateStickerLayout({ profile, stickerWidthMm, stickerHeightMm, gapMm = 0.1, allowRotation = true, insets = {} }) {
  const rawWidth = Number(stickerWidthMm); const rawHeight = Number(stickerHeightMm); const rawGap = Number(gapMm);
  if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight) || rawWidth <= 0 || rawHeight <= 0) throw new Error("Informe altura e largura maiores que zero.");
  if (!Number.isFinite(rawGap) || rawGap < 0) throw new Error("O espaçamento deve ser zero ou maior.");
  const left = toUm(profile.allowed.x) + toUm(insets.left || 0);
  const top = toUm(profile.allowed.y) + toUm(insets.top || 0);
  const width = toUm(profile.allowed.width) - toUm(insets.left || 0) - toUm(insets.right || 0);
  const height = toUm(profile.allowed.height) - toUm(insets.top || 0) - toUm(insets.bottom || 0);
  const itemWidth = toUm(rawWidth); const itemHeight = toUm(rawHeight); const gap = toUm(rawGap);
  if (width <= 0 || height <= 0) throw new Error("As margens configuradas consomem toda a área vermelha.");

  const candidates = [makeShelfCandidate(width, height, itemWidth, itemHeight, gap, allowRotation, false)];
  if (allowRotation && itemWidth !== itemHeight) candidates.push(makeShelfCandidate(width, height, itemWidth, itemHeight, gap, true, true));
  let best = candidates.reduce((current, candidate) => candidate.count > current.count ? candidate : current);
  const shelfCount = best.count;
  const actualUpperBound = Math.floor(((width + gap) * (height + gap)) / (itemWidth * itemHeight));
  // For smaller jobs, test several MaxRects strategies in addition to horizontal/vertical mixed shelves.
  // Large-count jobs use the fast row enumeration, avoiding a large quadratic search in the browser.
  if (allowRotation && shelfCount <= 120 && actualUpperBound <= 150) {
    const normal = packMaxRects(width, height, itemWidth, itemHeight, gap, true, 0, actualUpperBound);
    const rotatedFirst = packMaxRects(width, height, itemWidth, itemHeight, gap, true, 1, actualUpperBound);
    const areaFirst = packMaxRects(width, height, itemWidth, itemHeight, gap, true, 2, actualUpperBound);
    for (const candidate of [normal, rotatedFirst, areaFirst]) {
      const valid = validateStickerLayout(candidate.placements, fromUm(width), fromUm(height), rawGap);
      if (valid.valid && candidate.count > best.count) best = candidate;
    }
  }

  const placements = best.placements.map((item) => ({
    ...item,
    x: fromUm(toUm(item.x) + left),
    y: fromUm(toUm(item.y) + top),
  }));
  const validation = validateStickerLayout(placements.map((item) => ({
    ...item, x: fromUm(toUm(item.x) - left), y: fromUm(toUm(item.y) - top),
  })), fromUm(width), fromUm(height), rawGap);
  if (!validation.valid) throw new Error(`A montagem foi descartada: ${validation.reason}`);
  const allowed = {
    x: fromUm(left), y: fromUm(top), width: fromUm(width), height: fromUm(height),
  };
  const stickerArea = (itemWidth * itemHeight) / (UM_PER_MM * UM_PER_MM);
  const allowedArea = allowed.width * allowed.height;
  const usedArea = best.count * stickerArea;
  return {
    count: best.count,
    placements,
    allowed,
    allowedAreaMm2: allowedArea,
    usedAreaMm2: usedArea,
    wastedAreaMm2: Math.max(0, allowedArea - usedArea),
    utilization: allowedArea ? (usedArea / allowedArea) * 100 : 0,
    orientation: placements.every((item) => !item.rotated) ? "Original"
      : placements.every((item) => item.rotated) ? "Girado 90°" : "Mista",
    verified: true,
  };
}

export function calculatePaperComparison(options) {
  return ["A4", "A3"].map((id) => {
    const profile = options.profiles?.[id] || STICKER_SHEET_PROFILES[id];
    const layout = calculateStickerLayout({ ...options, profile, insets: options.insetsByPaper?.[id] || {} });
    return { id, label: profile.label, count: layout.count, utilization: layout.utilization, layout };
  });
}
