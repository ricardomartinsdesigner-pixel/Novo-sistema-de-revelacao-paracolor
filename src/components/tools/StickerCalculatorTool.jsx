import { useEffect, useMemo, useState } from "react";
import { Download, FileImage, FileText, Maximize2, Printer, Settings2, Sticker, TriangleAlert, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  calculatePaperComparison, STICKER_SHEET_PROFILES,
} from "@/lib/sticker-layout";
import { useSettings } from "@/lib/store";

const STORAGE_KEY = "paracolor-sticker-calculator-config-v1";
const LEGACY_DEFAULT_GAP_MM = 0.1;
const SHEETS = ["A4", "A3"];
const SIDES = ["left", "right", "top", "bottom"];
const SIDE_LABELS = { left: "Esquerda", right: "Direita", top: "Superior", bottom: "Inferior" };
const EMPTY_SIDES = () => ({ left: 0, right: 0, top: 0, bottom: 0 });
const makeSheetSettings = () => ({ A4: EMPTY_SIDES(), A3: EMPTY_SIDES() });
const DEFAULT_CONFIG = {
  margins: makeSheetSettings(),
  laserReserve: makeSheetSettings(),
  safetyMargin: { A4: 0, A3: 0 },
  gapMm: 0.6,
  allowRotation: true,
};
const mm = (value) => Number(value || 0).toFixed(2).replace(".", ",");
const cm = (valueMm) => `${(valueMm / 10).toFixed(2).replace(".", ",")} cm`;
const ptPerMm = 72 / 25.4;
const fileStem = (profile) => `paracolor-montagem-adesivos-${profile.id.toLowerCase()}`;
const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const hasPrice = (value) => value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

function mergeConfig(value) {
  const mergeSides = (input) => Object.fromEntries(SHEETS.map((id) => [id, { ...EMPTY_SIDES(), ...(input?.[id] || {}) }]));
  return {
    ...DEFAULT_CONFIG,
    ...value,
    margins: mergeSides(value?.margins),
    laserReserve: mergeSides(value?.laserReserve),
    safetyMargin: { ...DEFAULT_CONFIG.safetyMargin, ...(value?.safetyMargin || {}) },
  };
}

function readPngInfo(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 33 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) {
    throw new Error("O arquivo PNG não parece válido.");
  }
  const view = new DataView(buffer);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  let dpi = null;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (type === "pHYs" && length >= 9 && bytes[offset + 16] === 1) {
      dpi = Math.round(view.getUint32(offset + 8, false) * 0.0254);
    }
    offset += length + 12;
    if (type === "IEND" || offset > bytes.length) break;
  }
  return { width, height, dpi };
}

function readPsdDimensions(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 26 || String.fromCharCode(...bytes.slice(0, 4)) !== "8BPS") {
    throw new Error("O arquivo PSD não parece válido.");
  }
  const view = new DataView(buffer);
  return { height: view.getUint32(14, false), width: view.getUint32(18, false) };
}

function getImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function calculateRollLayout({ quantity, rollWidthMm, stickerWidthMm, stickerHeightMm, gapMm, sideMarginMm, allowRotation }) {
  const usableWidth = rollWidthMm - sideMarginMm * 2;
  if (![quantity, rollWidthMm, stickerWidthMm, stickerHeightMm, gapMm, sideMarginMm].every(Number.isFinite)
    || quantity < 1 || rollWidthMm <= 0 || stickerWidthMm < 5 || stickerHeightMm < 5 || gapMm < 0 || sideMarginMm < 0 || usableWidth <= 0) return null;
  const candidates = [
    { width: stickerWidthMm, height: stickerHeightMm, rotated: false },
    ...(allowRotation && stickerWidthMm !== stickerHeightMm ? [{ width: stickerHeightMm, height: stickerWidthMm, rotated: true }] : []),
  ].map((item) => {
    const columns = Math.floor((usableWidth + gapMm) / (item.width + gapMm));
    const rows = columns > 0 ? Math.ceil(quantity / columns) : 0;
    const lengthMm = rows ? rows * item.height + (rows - 1) * gapMm : 0;
    return { ...item, columns, rows, lengthMm };
  }).filter((item) => item.columns > 0);
  if (!candidates.length) return null;
  const best = candidates.sort((a, b) => a.lengthMm - b.lengthMm || b.columns - a.columns)[0];
  const placements = Array.from({ length: quantity }, (_, index) => ({
    x: sideMarginMm + (index % best.columns) * (best.width + gapMm),
    y: Math.floor(index / best.columns) * (best.height + gapMm),
    width: best.width,
    height: best.height,
    rotated: best.rotated,
  }));
  const areaMm2 = rollWidthMm * best.lengthMm;
  return { ...best, usableWidth, placements, areaMm2, linearMeters: best.lengthMm / 1000 };
}

function makeRollMaskSvg(layout, artwork, rollWidthMm) {
  const width = rollWidthMm;
  const height = Math.max(layout.lengthMm, 1);
  const paths = layout.placements.map((item) => `<path d="M ${item.x} ${item.y} h ${item.width} v ${item.height} h -${item.width} Z" fill="none" stroke="#ff00ff" stroke-width="0.15"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><title>Máscara de corte · ${artwork?.name || "adesivos"}</title>${paths}</svg>`;
}

function buildInsets(config, sheetId) {
  const result = {};
  for (const side of SIDES) {
    result[side] = Math.max(0, Number(config.margins[sheetId][side]) || 0)
      + Math.max(0, Number(config.laserReserve[sheetId][side]) || 0)
      + Math.max(0, Number(config.safetyMargin[sheetId]) || 0);
  }
  return result;
}

function Field({ label, value, onChange, min = 0, max = 1000, step = 0.1, suffix, required = false, ariaLabel }) {
  return (
    <label className="block min-w-0 text-xs text-muted-foreground">
      {label}
      <span className="mt-1 flex items-center rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
        <input
          type="number" inputMode="decimal" min={min} max={max} step={step} required={required}
          aria-label={ariaLabel || label} value={value} onChange={(event) => onChange(event.target.value)}
          className="min-w-0 w-full rounded-lg bg-transparent px-3 py-2.5 text-sm text-foreground outline-none"
        />
        {suffix && <span className="pr-3 text-xs">{suffix}</span>}
      </span>
    </label>
  );
}

function SheetPreview({ profile, layout, placements, stickerWidthMm, stickerHeightMm, artwork }) {
  const page = profile;
  return (
    <svg
      viewBox={`0 0 ${page.widthMm} ${page.heightMm}`} role="img"
      aria-label={`Prévia proporcional da folha ${page.id}, com ${placements.length} adesivos`}
      className="mx-auto block h-auto max-h-[75vh] w-full max-w-[600px] rounded-md border border-slate-300 bg-white shadow-sm"
    >
      <rect x="0" y="0" width={page.widthMm} height={page.heightMm} fill="#ffffff" />
      <rect
        x={page.allowed.x} y={page.allowed.y} width={page.allowed.width} height={page.allowed.height}
        fill="#fee2e2" stroke="#dc2626" strokeWidth="0.45" strokeDasharray="2 1.4"
      />
      <text x={page.allowed.x + 2} y={page.allowed.y + 5} fontSize="2.8" fill="#991b1b">
        ÁREA PERMITIDA PELO PDF
      </text>
      {(layout.allowed.x !== page.allowed.x || layout.allowed.y !== page.allowed.y || layout.allowed.width !== page.allowed.width || layout.allowed.height !== page.allowed.height) && (
        <rect x={layout.allowed.x} y={layout.allowed.y} width={layout.allowed.width} height={layout.allowed.height} fill="none" stroke="#2563eb" strokeWidth="0.35" strokeDasharray="1.5 1" />
      )}
      {page.marks.map(([x, y, width, height], index) => (
        <rect key={`mark-${index}`} x={x} y={y} width={width} height={height} fill="#111827" />
      ))}
      {placements.map((item, index) => {
        const label = `${cm(item.width)} × ${cm(item.height)}`;
        const fontSize = Math.max(0.75, Math.min(2.6, Math.min(item.width, item.height) * 0.2));
        return (
          <g key={`${index}-${item.x}-${item.y}`}>
            <title>{`Adesivo ${index + 1}: ${label}${item.rotated ? ", girado 90 graus" : ""}`}</title>
            {artwork?.dataUrl ? (
              <image
                href={artwork.dataUrl}
                x={item.rotated ? item.x + (item.width - item.height) / 2 : item.x}
                y={item.rotated ? item.y + (item.height - item.width) / 2 : item.y}
                width={item.rotated ? item.height : item.width}
                height={item.rotated ? item.width : item.height}
                transform={item.rotated ? `rotate(90 ${item.x + item.width / 2} ${item.y + item.height / 2})` : undefined}
                preserveAspectRatio="xMidYMid slice"
              />
            ) : <rect x={item.x} y={item.y} width={item.width} height={item.height} fill="#dbeafe" stroke="#0369a1" strokeWidth="0.3" />}
            <rect x={item.x} y={item.y} width={item.width} height={item.height} fill="none" stroke="#0369a1" strokeWidth="0.3" />
            {!artwork?.dataUrl && <text x={item.x + item.width / 2} y={item.y + item.height / 2 - fontSize * 0.1} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fill="#0c4a6e">{index + 1}</text>}
            {!artwork?.dataUrl && Math.min(item.width, item.height) >= 8 && (
              <text x={item.x + item.width / 2} y={item.y + item.height / 2 + fontSize * 1.05} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(0.7, fontSize * 0.62)} fill="#0c4a6e">
                {`${mm(item.width)}×${mm(item.height)}`}
              </text>
            )}
          </g>
        );
      })}
      <text x={page.widthMm / 2} y={page.heightMm - 3} textAnchor="middle" fontSize="2.5" fill="#475569">
        {`${page.label} · ${stickerWidthMm > 0 ? `${mm(stickerWidthMm)} × ${mm(stickerHeightMm)} mm` : ""}`}
      </text>
    </svg>
  );
}

function RollPreview({ layout, rollWidthMm, artwork }) {
  const preview = layout.placements.slice(0, 1200);
  return (
    <svg viewBox={`0 0 ${Math.max(layout.lengthMm, 1)} ${rollWidthMm}`} role="img" aria-label={`Encaixe de ${layout.placements.length} adesivos em bobina`}
      className="mx-auto block max-h-[55vh] w-full border border-slate-300 bg-white shadow-sm">
      <rect x="0" y="0" width={layout.lengthMm} height={rollWidthMm} fill="#fff" />
      {preview.map((item, index) => (
        <g key={`roll-${index}`}>
          {artwork?.dataUrl ? (
            <image href={artwork.dataUrl}
              x={item.rotated ? item.y : item.y + (item.height - item.width) / 2}
              y={item.rotated ? item.x : item.x + (item.width - item.height) / 2}
              width={item.rotated ? item.height : item.width}
              height={item.rotated ? item.width : item.height}
              transform={!item.rotated ? `rotate(90 ${item.y + item.height / 2} ${item.x + item.width / 2})` : undefined}
              preserveAspectRatio="xMidYMid slice" />
          ) : <rect x={item.y} y={item.x} width={item.height} height={item.width} fill={artwork?.dataUrl ? "#f1f5f9" : "#dbeafe"} />}
          <rect x={item.y} y={item.x} width={item.height} height={item.width} fill="none" stroke="#c026d3" strokeWidth="0.35" />
        </g>
      ))}
    </svg>
  );
}

function makeSvg(profile, placements, includeMarks, includePreview = false, allowed = profile.allowed, artwork = null) {
  const width = profile.widthMm;
  const height = profile.heightMm;
  const header = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">`;
  const body = [];
  if (artwork?.dataUrl) {
    body.push(`<defs><svg id="sticker-artwork" viewBox="0 0 ${artwork.width} ${artwork.height}" preserveAspectRatio="xMidYMid slice"><image x="0" y="0" width="${artwork.width}" height="${artwork.height}" href="${artwork.dataUrl}"/></svg></defs>`);
  }
  if (includePreview) {
    body.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>`);
    const red = profile.allowed;
    body.push(`<rect x="${red.x}" y="${red.y}" width="${red.width}" height="${red.height}" fill="#fee2e2" stroke="#dc2626" stroke-width="0.45" stroke-dasharray="2 1.4"/>`);
    if (allowed.x !== red.x || allowed.y !== red.y || allowed.width !== red.width || allowed.height !== red.height) {
      body.push(`<rect x="${allowed.x}" y="${allowed.y}" width="${allowed.width}" height="${allowed.height}" fill="none" stroke="#2563eb" stroke-width="0.35" stroke-dasharray="1.5 1"/>`);
    }
  }
  if (includeMarks) {
    for (const [x, y, markWidth, markHeight] of profile.marks) {
      body.push(`<rect x="${x}" y="${y}" width="${markWidth}" height="${markHeight}" fill="#111827"/>`);
    }
  }
  placements.forEach((item, index) => {
    const title = `Adesivo ${index + 1}: ${cm(item.width)} × ${cm(item.height)}`;
    const fontSize = Math.max(0.75, Math.min(2.6, Math.min(item.width, item.height) * 0.2));
    const dimension = !artwork?.dataUrl && Math.min(item.width, item.height) >= 8
      ? `<text x="${item.x + item.width / 2}" y="${item.y + item.height / 2 + fontSize}" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="${Math.max(0.65, fontSize * 0.6)}" fill="#0c4a6e">${mm(item.width)}×${mm(item.height)} mm</text>` : "";
    const art = artwork?.dataUrl
      ? `<use href="#sticker-artwork" x="${item.rotated ? item.x + (item.width - item.height) / 2 : item.x}" y="${item.rotated ? item.y + (item.height - item.width) / 2 : item.y}" width="${item.rotated ? item.height : item.width}" height="${item.rotated ? item.width : item.height}"${item.rotated ? ` transform="rotate(90 ${item.x + item.width / 2} ${item.y + item.height / 2})"` : ""}/>`
      : `<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" fill="${includePreview ? "#dbeafe" : "none"}"/>`;
    const number = artwork?.dataUrl ? "" : `<text x="${item.x + item.width / 2}" y="${item.y + item.height / 2 - fontSize * 0.2}" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="${fontSize}" fill="#0c4a6e">${index + 1}</text>`;
    body.push(`<g><title>${title}</title>${art}<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" fill="none" stroke="#0369a1" stroke-width="0.3"/>${number}${dimension}</g>`);
  });
  return `${header}${body.join("")}</svg>`;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function setPngResolution(blob, dpi) {
  const source = new Uint8Array(await blob.arrayBuffer());
  const readU32 = (offset) => ((source[offset] << 24) | (source[offset + 1] << 16) | (source[offset + 2] << 8) | source[offset + 3]) >>> 0;
  const ihdrEnd = 8 + 12 + readU32(8);
  const type = new TextEncoder().encode("pHYs");
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  view.setUint32(0, pixelsPerMeter, false);
  view.setUint32(4, pixelsPerMeter, false);
  data[8] = 1;
  let crc = 0xffffffff;
  for (const byte of [...type, ...data]) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const chunk = new Uint8Array(21);
  const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, data.length, false);
  chunk.set(type, 4); chunk.set(data, 8); chunkView.setUint32(17, crc, false);
  const output = new Uint8Array(source.length + chunk.length);
  output.set(source.slice(0, ihdrEnd)); output.set(chunk, ihdrEnd); output.set(source.slice(ihdrEnd), ihdrEnd + chunk.length);
  return new Blob([output], { type: "image/png" });
}

function StickerCalculatorDialog({ isAdmin = false }) {
  const { settings } = useSettings();
  const [calcMode, setCalcMode] = useState("sheet");
  const [sheetId, setSheetId] = useState("A4");
  const [widthCm, setWidthCm] = useState("5");
  const [heightCm, setHeightCm] = useState("5");
  const [rollWidthCm, setRollWidthCm] = useState("100");
  const [rollSideMarginMm, setRollSideMarginMm] = useState("0");
  const [desiredQuantity, setDesiredQuantity] = useState("");
  const [includeMarks, setIncludeMarks] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [artwork, setArtwork] = useState(null);

  async function handleArtworkUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      if (file.size > 150 * 1024 * 1024) throw new Error("O arquivo deve ter até 150 MB.");
      const extension = file.name.split(".").pop()?.toLowerCase();
      const buffer = await file.arrayBuffer();
      let info;
      let dataUrl;
      if (extension === "png") {
        info = readPngInfo(buffer);
        dataUrl = await getImageDataUrl(file);
      } else if (extension === "psd") {
        info = readPsdDimensions(buffer);
        const { readPsd } = await import("ag-psd");
        const psd = readPsd(buffer, { imageResourcesWhitelist: ["resolutionInfo"] });
        const canvas = psd.canvas;
        if (!canvas) throw new Error("Não foi possível gerar a prévia deste PSD. Salve o arquivo com a composição visível e tente novamente.");
        const resolution = psd.imageResources?.resolutionInfo;
        info.dpi = resolution?.horizontalResolution > 0 ? Math.round(resolution.horizontalResolution) : null;
        dataUrl = await new Promise((resolve, reject) => canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Não foi possível gerar a prévia do PSD.")); return; }
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Não foi possível ler a prévia do PSD."));
          reader.readAsDataURL(blob);
        }, "image/png"));
      } else {
        throw new Error("Selecione um arquivo PNG ou PSD.");
      }
      if (!(info.width > 0 && info.height > 0)) throw new Error("O arquivo não contém dimensões válidas.");
      const dpi = info.dpi || 300;
      setWidthCm((info.width * 2.54 / dpi).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""));
      setHeightCm((info.height * 2.54 / dpi).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""));
      setArtwork({ name: file.name, width: info.width, height: info.height, dpi, dpiSource: info.dpi ? "do arquivo" : "referência de 300 dpi", dataUrl });
    } catch (cause) {
      setError(cause?.message || "Não foi possível abrir esse arquivo.");
    }
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const savedConfig = JSON.parse(stored);
        const nextConfig = mergeConfig(savedConfig);
        // Migra o padrão anterior; valores personalizados diferentes de 0,1 mm são preservados.
        if (Number(savedConfig?.gapMm) === LEGACY_DEFAULT_GAP_MM) nextConfig.gapMm = DEFAULT_CONFIG.gapMm;
        setConfig(nextConfig);
      }
    } catch {
      setSaved(false);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return undefined;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        setSaved(true);
      } catch {
        setSaved(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [config, loaded]);

  const profile = STICKER_SHEET_PROFILES[sheetId];
  const insetsByPaper = useMemo(() => Object.fromEntries(SHEETS.map((id) => [id, buildInsets(config, id)])), [config]);
  const layoutResult = useMemo(() => {
    const width = Number(widthCm) * 10;
    const height = Number(heightCm) * 10;
    if (!(width > 0 && height > 0)) return { layout: null, comparison: [], error: "Informe altura e largura maiores que zero." };
    if (width < 5 || height < 5) return { layout: null, comparison: [], error: "Para manter a prévia e as exportações rápidas, cada medida deve ter pelo menos 0,5 cm." };
    try {
      const options = { stickerWidthMm: width, stickerHeightMm: height, gapMm: Number(config.gapMm), allowRotation: config.allowRotation, insetsByPaper, profiles: STICKER_SHEET_PROFILES };
      const comparisonResults = calculatePaperComparison(options);
      const selected = comparisonResults.find((item) => item.id === sheetId);
      return {
        layout: selected?.layout || null,
        comparison: comparisonResults.map((item) => ({ id: item.id, label: item.label, count: item.count, utilization: item.utilization })),
        error: "",
      };
    } catch (cause) {
      return { layout: null, comparison: [], error: cause?.message || "Confira as medidas informadas." };
    }
  }, [widthCm, heightCm, config, profile, sheetId, insetsByPaper]);
  const layout = layoutResult.layout;
  const wanted = Math.max(0, Math.floor(Number(desiredQuantity) || 0));
  const sheetQuantity = wanted || layout?.count || 0;
  const sheetCount = layout && sheetQuantity ? Math.ceil(sheetQuantity / layout.count) : 0;
  const lastSheetCount = sheetCount ? sheetQuantity - (sheetCount - 1) * layout.count : 0;
  const sheetPriceKey = sheetId === "A4" ? "sticker_price_a4" : "sticker_price_a3";
  const sheetPrice = settings?.[sheetPriceKey];
  const hasSheetPrice = hasPrice(sheetPrice);
  const sheetQuote = Math.round(sheetCount * Number(sheetPrice || 0) * 100) / 100;
  const rollLayout = useMemo(() => {
    const quantity = Math.floor(Number(desiredQuantity) || 0);
    const rollWidth = Number(rollWidthCm) * 10;
    const stickerWidth = Number(widthCm) * 10;
    const stickerHeight = Number(heightCm) * 10;
    const sideMargin = Number(rollSideMarginMm) || 0;
    if (!(quantity > 0 && quantity <= 20000 && rollWidth > 0 && stickerWidth >= 5 && stickerHeight >= 5)) return null;
    return calculateRollLayout({ quantity, rollWidthMm: rollWidth, stickerWidthMm: stickerWidth, stickerHeightMm: stickerHeight, gapMm: Number(config.gapMm) || 0, sideMarginMm: sideMargin, allowRotation: config.allowRotation });
  }, [desiredQuantity, rollWidthCm, widthCm, heightCm, rollSideMarginMm, config.gapMm, config.allowRotation]);
  const meterPrice = settings?.sticker_price_per_meter;
  const minimumCharge = settings?.sticker_minimum_charge;
  const hasRollPrices = hasPrice(meterPrice) && hasPrice(minimumCharge);
  const rollQuote = rollLayout && hasRollPrices
    ? Math.round(Math.max(rollLayout.linearMeters * Number(meterPrice), Number(minimumCharge)) * 100) / 100
    : null;
  const displayedCount = layout ? (wanted ? Math.min(wanted, layout.count) : layout.count) : 0;
  const placements = layout?.placements.slice(0, displayedCount) || [];
  const previewPlacements = placements.slice(0, 1200);
  const includedArea = placements.reduce((total, item) => total + item.width * item.height, 0);
  const wastedArea = layout ? Math.max(0, layout.allowedAreaMm2 - includedArea) : 0;
  const usedUtilization = layout?.allowedAreaMm2 ? (includedArea / layout.allowedAreaMm2) * 100 : 0;

  function updateSide(group, side, value) {
    setConfig((previous) => ({
      ...previous,
      [group]: { ...previous[group], [sheetId]: { ...previous[group][sheetId], [side]: value } },
    }));
  }

  function currentSvg(preview = false) {
    return makeSvg(profile, placements, includeMarks, preview, layout?.allowed || profile.allowed, artwork);
  }

  async function exportPdf() {
    if (!layout || !placements.length) return;
    setBusy("pdf"); setError("");
    try {
      const { PDFDocument, rgb, StandardFonts, degrees } = await import("pdf-lib");
      const document = await PDFDocument.create();
      const font = await document.embedFont(StandardFonts.Helvetica);
      const p = (value) => value * ptPerMm;
      const quantityToPrint = wanted || layout.count;
      const pagesToPrint = Math.ceil(quantityToPrint / layout.count);
      const artworkImage = artwork?.dataUrl
        ? await document.embedPng(Uint8Array.from(atob(artwork.dataUrl.split(",")[1]), (character) => character.charCodeAt(0)))
        : null;
      for (let sheetIndex = 0; sheetIndex < pagesToPrint; sheetIndex += 1) {
        const page = document.addPage([profile.widthMm * ptPerMm, profile.heightMm * ptPerMm]);
        if (includeMarks) {
          for (const [x, y, markWidth, markHeight] of profile.marks) {
            page.drawRectangle({ x: p(x), y: p(profile.heightMm - y - markHeight), width: p(markWidth), height: p(markHeight), color: rgb(0.05, 0.07, 0.1) });
          }
        }
        const pageQuantity = Math.min(layout.count, quantityToPrint - sheetIndex * layout.count);
        layout.placements.slice(0, pageQuantity).forEach((item, index) => {
          const y = profile.heightMm - item.y - item.height;
          if (artworkImage) {
            const imageOptions = {
              x: p(item.rotated ? item.x + item.width : item.x),
              y: p(y),
              width: p(item.rotated ? item.height : item.width),
              height: p(item.rotated ? item.width : item.height),
            };
            if (item.rotated) imageOptions.rotate = degrees(90);
            page.drawImage(artworkImage, imageOptions);
          }
          page.drawRectangle({ x: p(item.x), y: p(y), width: p(item.width), height: p(item.height), borderColor: rgb(0.012, 0.41, 0.63), borderWidth: p(0.18) });
          if (!artworkImage) {
            const size = Math.min(5, Math.max(2, p(Math.min(item.width, item.height) * 0.18)));
            page.drawText(String(sheetIndex * layout.count + index + 1), { x: p(item.x) + p(item.width) / 2 - size * 0.35, y: p(y) + p(item.height) / 2 - size * 0.3, size, font, color: rgb(0.05, 0.29, 0.43) });
          }
          if (!artworkImage && Math.min(item.width, item.height) >= 8) {
            const dimensions = `${mm(item.width)} x ${mm(item.height)} mm`;
            const labelSize = Math.max(1.5, Math.min(3, p(Math.min(item.width, item.height) * 0.11)));
            const textWidth = font.widthOfTextAtSize(dimensions, labelSize);
            page.drawText(dimensions, { x: p(item.x) + Math.max(0, (p(item.width) - textWidth) / 2), y: p(y) + p(item.height) / 2 - labelSize - 0.5, size: labelSize, font, color: rgb(0.05, 0.29, 0.43) });
          }
        });
      }
      document.setTitle(`Montagem de adesivos ${profile.id}`);
      document.setSubject(`Escala 1:1 · folha de ${profile.widthMm} × ${profile.heightMm} mm`);
      downloadBlob(new Blob([await document.save()], { type: "application/pdf" }), `${fileStem(profile)}-${pagesToPrint}-folha${pagesToPrint > 1 ? "s" : ""}.pdf`);
    } catch {
      setError("Não foi possível gerar o PDF. Tente novamente.");
    } finally { setBusy(""); }
  }

  function exportSvg() {
    if (!layout || !placements.length) return;
    downloadBlob(new Blob([currentSvg(false)], { type: "image/svg+xml;charset=utf-8" }), `${fileStem(profile)}.svg`);
  }

  function exportRollMask() {
    if (!rollLayout) return;
    const svg = makeRollMaskSvg(rollLayout, artwork, Number(rollWidthCm) * 10);
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `paracolor-mascara-corte-${rollWidthCm.replace(".", "-")}cm.svg`);
  }

  async function exportPng() {
    if (!layout || !placements.length) return;
    setBusy("png"); setError("");
    try {
      const svg = currentSvg(true);
      const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      try {
        const image = new Image();
        image.src = svgUrl;
        await image.decode();
        const dpi = 300;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(profile.widthMm / 25.4 * dpi);
        canvas.height = Math.round(profile.heightMm / 25.4 * dpi);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas indisponível.");
        context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("PNG indisponível.");
        downloadBlob(await setPngResolution(blob, dpi), `${fileStem(profile)}-300dpi.png`);
      } finally { URL.revokeObjectURL(svgUrl); }
    } catch {
      setError("Não foi possível gerar o PNG nesta tentativa.");
    } finally { setBusy(""); }
  }

  function printPreview() {
    if (!layout || !placements.length) return;
    const printWindow = window.open("", "_blank", "width=900,height=900");
    if (!printWindow) { setError("O navegador bloqueou a janela de impressão. Permita pop-ups para este site."); return; }
    const svg = currentSvg(true);
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><title>Montagem ${profile.id}</title><style>@page{size:${profile.widthMm}mm ${profile.heightMm}mm;margin:0}html,body{margin:0;padding:0;width:${profile.widthMm}mm;height:${profile.heightMm}mm}svg{display:block;width:${profile.widthMm}mm;height:${profile.heightMm}mm}@media screen{body{display:grid;place-items:center;background:#e2e8f0}svg{width:min(90vw,${profile.widthMm}mm);height:auto;box-shadow:0 2px 14px #64748b}}</style></head><body>${svg}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350))</script></body></html>`);
    printWindow.document.close();
  }

  function changeConfig(key, value) {
    setConfig((previous) => ({ ...previous, [key]: value }));
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="card-glass group flex min-h-28 w-full items-start gap-3 p-5 text-left font-body transition hover:border-primary/50 hover:shadow-md">
          <span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Sticker className="h-5 w-5" /></span>
          <span>
            <span className="block text-sm font-semibold text-foreground">Aproveitamento de adesivos</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Encaixe A4 e A3, confira a folha e exporte em escala 1:1.</span>
          </span>
          <Maximize2 className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
        </button>
      </DialogTrigger>
      <DialogContent className="font-body grid max-h-[96dvh] w-[calc(100%_-_1rem)] max-w-7xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl p-4 sm:p-6">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="flex items-center gap-2 font-body text-xl font-semibold tracking-normal"><Sticker className="h-5 w-5 text-primary" /> Calculadora de aproveitamento de adesivos</DialogTitle>
          <DialogDescription className="font-body text-sm leading-relaxed">Compare encaixes mistos e rotação localmente; os limites são os vetores reais da área vermelha nos modelos A4 e A3 enviados.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="mb-4 grid grid-cols-2 border-b border-border" role="tablist" aria-label="Tipo de cálculo de adesivos">
            <button type="button" role="tab" aria-selected={calcMode === "sheet"} onClick={() => setCalcMode("sheet")} className={`border-b-2 px-3 py-3 text-left font-body text-sm font-semibold tracking-normal ${calcMode === "sheet" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              Folhas A4 / A3
            </button>
            <button type="button" role="tab" aria-selected={calcMode === "roll"} onClick={() => setCalcMode("roll")} className={`border-b-2 px-3 py-3 text-left font-body text-sm font-semibold tracking-normal ${calcMode === "roll" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              Bobina por metro
            </button>
          </div>
          {calcMode === "sheet" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(290px,370px)_minmax(0,1fr)]">
            <div className="space-y-4">
              <section className="rounded-xl border bg-card p-4">
                <h3 className="font-body text-sm font-semibold tracking-normal">Arquivo do adesivo</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Envie PNG ou PSD para preencher as medidas e aplicar a arte em cada posição da folha. Uma arte já cortada no tamanho final será repetida sem ajuste de enquadramento.</p>
                <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input px-3 py-3 text-sm font-medium transition hover:border-primary hover:bg-primary/5">
                  <Upload className="h-4 w-4" /> {artwork ? "Trocar arquivo" : "Escolher PNG ou PSD"}
                  <input type="file" accept=".png,.psd,image/png" onChange={handleArtworkUpload} className="sr-only" />
                </label>
                {artwork && (
                  <div className="mt-3 flex items-start gap-3 rounded-lg border bg-background p-2.5">
                    <img src={artwork.dataUrl} alt="Prévia do adesivo enviado" className="h-16 w-16 shrink-0 rounded border bg-white object-contain" />
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="truncate font-medium text-foreground" title={artwork.name}>{artwork.name}</p>
                      <p className="mt-1 text-muted-foreground">{artwork.width} × {artwork.height} px · {artwork.dpi} dpi ({artwork.dpiSource})</p>
                      <p className="text-muted-foreground">Medida física preenchida: {cm(Number(widthCm) * 10)} × {cm(Number(heightCm) * 10)}</p>
                    </div>
                    <button type="button" aria-label="Remover arquivo do adesivo" onClick={() => setArtwork(null)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>
                )}
                {!artwork && <p className="mt-2 text-[11px] text-muted-foreground">Sem resolução registrada, o arquivo será considerado em 300 dpi. Você pode ajustar as medidas abaixo.</p>}
              </section>

              <section className="rounded-xl border bg-card p-4">
                <h3 className="font-body text-sm font-semibold tracking-normal">Medidas e opções</h3>
                <div className="mt-3">
                  <label className="block text-xs text-muted-foreground">
                    Tamanho da folha
                    <select value={sheetId} onChange={(event) => setSheetId(event.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground">
                      {SHEETS.map((id) => <option key={id} value={id}>{STICKER_SHEET_PROFILES[id].label}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Largura do adesivo · mín. 0,5 cm" value={widthCm} onChange={setWidthCm} min={0.5} max={100} step={0.01} suffix="cm" required />
                  <Field label="Altura do adesivo · mín. 0,5 cm" value={heightCm} onChange={setHeightCm} min={0.5} max={100} step={0.01} suffix="cm" required />
                  <Field label="Espaço entre bordas" value={config.gapMm} onChange={(value) => changeConfig("gapMm", value)} min={0} max={50} step={0.01} suffix="mm" />
                  <Field label="Quantidade desejada" value={desiredQuantity} onChange={setDesiredQuantity} min={1} max={20000} step={1} suffix="un." ariaLabel="Quantidade de adesivos desejada, opcional" />
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
                  <input type="checkbox" checked={config.allowRotation} onChange={(event) => changeConfig("allowRotation", event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                  <span><span className="font-medium">Permitir rotação de 90°</span><span className="mt-0.5 block text-xs text-muted-foreground">Desmarque para manter todos na orientação original.</span></span>
                </label>
                <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={includeMarks} onChange={(event) => setIncludeMarks(event.target.checked)} className="h-4 w-4 accent-primary" />
                  <span>Incluir marcas de referência nas exportações</span>
                </label>
                <p className="ml-6 mt-1 text-[11px] text-muted-foreground">As marcas aparecem na prévia; os arquivos exportados ficam sem elas até você marcar esta opção.</p>
              </section>

              <section className="rounded-xl border bg-card p-4">
                <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold">
                  <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Configurações avançadas</span>
                  <span className="text-xs font-normal text-muted-foreground">{showAdvanced ? "Ocultar" : "Abrir"}</span>
                </button>
                {showAdvanced && (
                  <div className="mt-4 space-y-4">
                    <p className="text-xs leading-relaxed text-muted-foreground">As medidas abaixo são aplicadas para dentro da área vermelha. As marcas dos PDFs já ficam fora dela; a reserva começa em zero e só reduz a área se você configurar.</p>
                    <div>
                      <h4 className="font-body text-xs font-semibold tracking-normal">Margens internas do arquivo</h4>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {SIDES.map((side) => <Field key={`margin-${side}`} label={SIDE_LABELS[side]} value={config.margins[sheetId][side]} onChange={(value) => updateSide("margins", side, value)} suffix="mm" step={0.1} />)}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-body text-xs font-semibold tracking-normal">Reserva adicional para leitura do laser</h4>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {SIDES.map((side) => <Field key={`laser-${side}`} label={SIDE_LABELS[side]} value={config.laserReserve[sheetId][side]} onChange={(value) => updateSide("laserReserve", side, value)} suffix="mm" step={0.1} />)}
                      </div>
                    </div>
                    <Field label="Margem de segurança adicional (todos os lados)" value={config.safetyMargin[sheetId]} onChange={(value) => setConfig((previous) => ({ ...previous, safetyMargin: { ...previous.safetyMargin, [sheetId]: value } }))} suffix="mm" step={0.1} />
                    <p role="status" className="text-[11px] text-muted-foreground">{saved ? "Configurações salvas neste navegador e separadas por tamanho de folha." : "As configurações ainda não puderam ser salvas neste navegador."}</p>
                  </div>
                )}
              </section>

              {layout && (
                <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Capacidade da folha</p>
                  <p className="mt-1 text-4xl font-bold tracking-tight text-primary">{layout.count}<span className="ml-2 text-base font-medium">adesivos</span></p>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-primary/15 py-3 text-sm">
                    <span className="text-muted-foreground">Quantidade do pedido</span><strong>{sheetQuantity} adesivos</strong>
                    <span className="text-muted-foreground">Folhas necessárias</span><strong>{sheetCount}</strong>
                    {isAdmin && <><span className="text-muted-foreground">Adesivos na última folha</span><strong>{lastSheetCount}</strong>
                    <span className="text-muted-foreground">Espaços livres na última</span><strong>{layout.count - lastSheetCount}</strong></>}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <span className="text-muted-foreground">Folha</span><strong>{profile.id} · {mm(profile.widthMm)} × {mm(profile.heightMm)} mm</strong>
                    <span className="text-muted-foreground">Adesivo</span><strong>{cm(Number(widthCm) * 10)} × {cm(Number(heightCm) * 10)}</strong>
                    <span className="text-muted-foreground">Orientação</span><strong>{layout.orientation}</strong>
                    <span className="text-muted-foreground">Espaçamento</span><strong>{mm(Number(config.gapMm))} mm entre bordas</strong>
                    <span className="text-muted-foreground">Área ocupada pelos adesivos</span><strong>{(includedArea / 100).toFixed(2).replace(".", ",")} cm²</strong>
                    {isAdmin && <><span className="text-muted-foreground">Área livre estimada</span><strong>{(wastedArea / 100).toFixed(2).replace(".", ",")} cm²</strong>
                    <span className="text-muted-foreground">Aproveitamento da montagem</span><strong>{usedUtilization.toFixed(1).replace(".", ",")}%</strong>
                    <span className="text-muted-foreground">Melhor aproveitamento encontrado</span><strong>{layout.utilization.toFixed(1).replace(".", ",")}%</strong></>}
                  </div>
                  {wanted > 0 && <p role="status" className="mt-3 text-xs leading-relaxed text-muted-foreground">O PDF será gerado com {sheetCount} {sheetCount === 1 ? "folha" : "folhas"} e {sheetQuantity} adesivos, distribuídos de acordo com a capacidade calculada.</p>}
                  {wanted > 0 && <div className="mt-4 border border-primary/20 bg-background p-3" aria-live="polite">
                    <span className="block text-xs text-muted-foreground">Orçamento estimado</span>
                    {hasSheetPrice ? <strong className="mt-1 block text-2xl text-primary">{money(sheetQuote)}</strong> : <p className="mt-1 text-sm text-muted-foreground">Valor ainda não configurado. Consulte a equipe.</p>}
                    {isAdmin && hasSheetPrice && <span className="mt-1 block text-xs text-muted-foreground">{sheetCount} {sheetCount === 1 ? "folha" : "folhas"} × {money(Number(sheetPrice))}</span>}
                  </div>}
                </section>
              )}
            </div>

            <div className="space-y-4">
              <section className="rounded-xl border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div><h3 className="font-body text-sm font-semibold tracking-normal">Prévia em escala proporcional</h3><p className="mt-1 text-xs text-muted-foreground">Vermelho: limite do PDF · preto: marcas do laser · azul: contorno de corte e margens adicionais</p></div>
                  {layout && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">Montagem validada</span>}
                </div>
                {layout ? <SheetPreview profile={profile} layout={layout} placements={previewPlacements} stickerWidthMm={Number(widthCm) * 10} stickerHeightMm={Number(heightCm) * 10} artwork={artwork} /> : <div className="grid min-h-80 place-items-center rounded-lg bg-muted/40 p-6 text-center text-sm text-muted-foreground">{layoutResult.error || "Informe medidas válidas para visualizar a montagem."}</div>}
                {placements.length > previewPlacements.length && <p className="mt-2 text-xs text-muted-foreground">A prévia exibe os primeiros {previewPlacements.length} adesivos para manter a tela rápida. As exportações incluem todos os {placements.length} planejados.</p>}
                {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Cada retângulo tem numeração e dimensões no identificador da prévia. O cálculo considera as margens do vetor vermelho; as marcas pretas ficam fora dessa região.</p>
              </section>

              <section className="rounded-xl border bg-card p-4">
                <h3 className="font-body text-sm font-semibold tracking-normal">Comparativo de folhas</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {layoutResult.comparison.map((item) => (
                    <button key={item.id} type="button" onClick={() => setSheetId(item.id)} className={`rounded-lg border p-3 text-left transition ${item.id === sheetId ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}>
                      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{item.label}</span>{item.id === sheetId && <span className="font-medium text-primary">Selecionada</span>}</span>
                      <strong className="mt-2 block text-2xl">{item.count} adesivos</strong>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.utilization.toFixed(1).replace(".", ",")}% de aproveitamento</span>
                    </button>
                  ))}
                </div>
                {layoutResult.comparison.length === 2 && <p className="mt-3 text-xs text-muted-foreground">Melhor capacidade para essas medidas: <strong className="text-foreground">{[...layoutResult.comparison].sort((a, b) => b.count - a.count)[0].id}</strong>.</p>}
              </section>

              <section className="rounded-xl border bg-card p-4">
                <h3 className="font-body text-sm font-semibold tracking-normal">Exportar montagem</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">O PDF inclui a quantidade informada, distribuída em várias páginas quando necessário. SVG, PNG e impressão mostram uma folha. Confira a escala 100% / tamanho real.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={exportPdf} disabled={!layout || !placements.length || Boolean(busy)} className="gap-1.5"><FileText className="h-4 w-4" />{busy === "pdf" ? "Gerando PDF…" : `PDF 1:1 · ${sheetCount || 1} ${sheetCount === 1 ? "folha" : "folhas"}`}</Button>
                  <Button size="sm" variant="outline" onClick={exportSvg} disabled={!layout || !placements.length || Boolean(busy)} className="gap-1.5"><Download className="h-4 w-4" />SVG</Button>
                  <Button size="sm" variant="outline" onClick={exportPng} disabled={!layout || !placements.length || Boolean(busy)} className="gap-1.5"><FileImage className="h-4 w-4" />{busy === "png" ? "Gerando PNG…" : "PNG · 300 dpi"}</Button>
                  <Button size="sm" variant="outline" onClick={printPreview} disabled={!layout || !placements.length || Boolean(busy)} className="gap-1.5"><Printer className="h-4 w-4" />Imprimir</Button>
                </div>
                {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
              </section>
            </div>
          </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(300px,390px)_minmax(0,1fr)]">
              <div className="space-y-4">
                <section className="border border-border bg-card p-4">
                  <h3 className="font-body text-base font-semibold tracking-normal">Arquivo do adesivo</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Envie a arte final em PNG ou PSD. O arquivo já cortado no tamanho correto é repetido na bobina sem novo enquadramento.</p>
                  <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 border border-dashed border-input px-3 py-3 text-sm font-semibold transition hover:border-primary hover:bg-primary/5">
                    <Upload className="h-4 w-4" /> {artwork ? "Trocar arquivo" : "Escolher PNG ou PSD"}
                    <input type="file" accept=".png,.psd,image/png" onChange={handleArtworkUpload} className="sr-only" />
                  </label>
                  {artwork && <div className="mt-3 flex items-center gap-3 border border-border bg-background p-2.5">
                    <img src={artwork.dataUrl} alt="Prévia da arte do adesivo" className="h-14 w-14 shrink-0 border border-border bg-white object-contain" />
                    <div className="min-w-0 text-xs"><p className="truncate font-semibold" title={artwork.name}>{artwork.name}</p><p className="mt-1 text-muted-foreground">{artwork.width} × {artwork.height} px · {artwork.dpi} dpi</p><p className="text-muted-foreground">Tamanho: {cm(Number(widthCm) * 10)} × {cm(Number(heightCm) * 10)}</p></div>
                    <button type="button" aria-label="Remover arquivo" onClick={() => setArtwork(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>}
                  {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
                </section>

                <section className="border border-border bg-card p-4">
                  <h3 className="font-body text-base font-semibold tracking-normal">Medidas e espaçamento</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Informe a quantidade e a largura útil da bobina.</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Largura do adesivo" value={widthCm} onChange={setWidthCm} min={0.5} max={100} step={0.01} suffix="cm" required />
                    <Field label="Altura do adesivo" value={heightCm} onChange={setHeightCm} min={0.5} max={100} step={0.01} suffix="cm" required />
                    <Field label="Quantidade desejada" value={desiredQuantity} onChange={setDesiredQuantity} min={1} max={20000} step={1} suffix="un." required />
                    <Field label="Largura da bobina" value={rollWidthCm} onChange={setRollWidthCm} min={1} max={300} step={0.1} suffix="cm" required />
                    <Field label="Espaço entre adesivos" value={config.gapMm} onChange={(value) => changeConfig("gapMm", value)} min={0} max={50} step={0.01} suffix="mm" />
                    <Field label="Margem lateral" value={rollSideMarginMm} onChange={setRollSideMarginMm} min={0} max={200} step={0.1} suffix="mm" />
                  </div>
                  <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
                    <input type="checkbox" checked={config.allowRotation} onChange={(event) => changeConfig("allowRotation", event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                    <span><span className="font-semibold">Permitir rotação de 90°</span><span className="mt-0.5 block text-xs text-muted-foreground">A ferramenta escolhe a orientação que consome menos material.</span></span>
                  </label>
                </section>

                {rollLayout ? <section className="border border-primary/25 bg-primary/5 p-4">
                  <h3 className="font-body text-base font-semibold tracking-normal">Consumo estimado da bobina</h3>
                  <p className="mt-2 text-3xl font-bold tracking-normal text-primary">{rollLayout.linearMeters.toFixed(2).replace(".", ",")} m lineares</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-primary/15 pt-3 text-sm">
                    <span className="text-muted-foreground">Área consumida</span><strong>{(rollLayout.areaMm2 / 1_000_000).toFixed(3).replace(".", ",")} m²</strong>
                    <span className="text-muted-foreground">Área das artes</span><strong>{(rollLayout.placements.length * Number(widthCm) * Number(heightCm) / 10000).toFixed(3).replace(".", ",")} m²</strong>
                    <span className="text-muted-foreground">Adesivos por fileira</span><strong>{rollLayout.columns}</strong>
                    <span className="text-muted-foreground">Fileiras</span><strong>{rollLayout.rows}</strong>
                    <span className="text-muted-foreground">Orientação escolhida</span><strong>{rollLayout.rotated ? "Girados 90°" : "Original"}</strong>
                  </div>
                  {rollLayout && <div className="mt-4 border border-primary/20 bg-background p-3" aria-live="polite">
                    <span className="block text-xs text-muted-foreground">Orçamento estimado</span>
                    {hasRollPrices ? <strong className="mt-1 block text-2xl text-primary">{money(rollQuote)}</strong> : <p className="mt-1 text-sm text-muted-foreground">Valor ainda não configurado. Consulte a equipe.</p>}
                    {isAdmin && hasRollPrices && <span className="mt-1 block text-xs text-muted-foreground">Consumo de {rollLayout.linearMeters.toFixed(2).replace(".", ",")} m · mínimo aplicado conforme configuração.</span>}
                  </div>}
                </section> : <p className="border border-amber-300 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">Preencha uma quantidade válida e confira se o adesivo cabe na largura útil da bobina. O limite deste cálculo é 20.000 unidades por vez.</p>}
              </div>

              <div className="space-y-4">
                <section className="border border-border bg-card p-4">
                  <h3 className="font-body text-base font-semibold tracking-normal">Prévia do encaixe na bobina</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">A escala do desenho é proporcional. Rosa: contornos individuais para corte.</p>
                  {rollLayout ? <RollPreview layout={rollLayout} rollWidthMm={Number(rollWidthCm) * 10} artwork={artwork} /> : <div className="mt-3 grid min-h-48 place-items-center border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Informe as medidas, a quantidade e a largura da bobina para ver o encaixe.</div>}
                  {rollLayout && rollLayout.placements.length > 1200 && <p className="mt-2 text-xs text-muted-foreground">Prévia limitada às primeiras 1.200 unidades; máscara inclui todas as {rollLayout.placements.length}.</p>}
                </section>
                <section className="border border-border bg-card p-4">
                  <h3 className="font-body text-base font-semibold tracking-normal">Máscara para corte</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Baixe um SVG em tamanho real com uma linha vetorial retangular para cada adesivo. A arte não vai nesta máscara.</p>
                  <Button type="button" onClick={exportRollMask} disabled={!rollLayout || Boolean(busy)} className="mt-3 gap-2 rounded-none"><Download className="h-4 w-4" />Baixar máscara de corte SVG</Button>
                  {rollLayout && <p className="mt-2 text-xs text-muted-foreground">Bobina: {mm(Number(rollWidthCm) * 10)} mm de largura × {mm(rollLayout.lengthMm)} mm de comprimento. Confira escala e cor de corte no software da máquina.</p>}
                </section>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function StickerCalculatorTool({ isAdmin = false }) {
  return <StickerCalculatorDialog isAdmin={isAdmin} />;
}
