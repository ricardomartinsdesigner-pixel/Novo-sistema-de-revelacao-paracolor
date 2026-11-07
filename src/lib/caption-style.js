// Fontes da legenda: as cursivas são webfonts (carregadas no __root), então
// aparecem iguais no celular, no desktop e no arquivo de impressão.
export const CAPTION_FONTS = [
  { value: "hand", label: "Manuscrita", stack: "'Caveat', 'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive" },
  { value: "dancing", label: "Cursiva delicada", stack: "'Dancing Script', 'Snell Roundhand', 'Brush Script MT', cursive" },
  { value: "greatvibes", label: "Cursiva clássica", stack: "'Great Vibes', 'Snell Roundhand', 'Segoe Script', cursive" },
  { value: "sacramento", label: "Cursiva fina", stack: "'Sacramento', 'Snell Roundhand', cursive" },
  { value: "parisienne", label: "Cursiva romântica", stack: "'Parisienne', 'Snell Roundhand', cursive" },
  { value: "serif", label: "Clássica", stack: "'Instrument Serif', Georgia, 'Times New Roman', serif" },
  { value: "sans", label: "Moderna", stack: "Inter, Arial, sans-serif" },
  { value: "cond", label: "Condensada", stack: "'Arial Narrow', 'Helvetica Neue', Inter, sans-serif" },
  { value: "mono", label: "Máquina", stack: "ui-monospace, Menlo, monospace" },
];

export function captionFont(style) {
  const found = CAPTION_FONTS.find((font) => font.value === (style?.font || "hand"));
  return (found || CAPTION_FONTS[0]).stack;
}

// O arquivo de impressão é desenhado no canvas, que não espera a fonte baixar:
// sem isso o texto sairia com uma fonte diferente da prévia.
export async function ensureCaptionFont(style) {
  if (typeof document === "undefined" || !document.fonts) return;
  const first = captionFont(style).split(",")[0].replace(/['"]/g, "").trim();
  if (!first) return;
  try {
    await document.fonts.load(`${style?.bold ? "600 " : ""}64px "${first}"`);
  } catch {
    // Fonte do sistema ou indisponível: a pilha de fallback continua valendo.
  }
}

export const CAPTION_ELEMENTS = [
  { value: "none", label: "Nenhum", glyph: "" },
  { value: "hearts", label: "Corações", glyph: "♡ ♡ ♡" },
  { value: "stars", label: "Estrelas", glyph: "✦ ✦ ✦" },
  { value: "flower", label: "Flor", glyph: "❀" },
  { value: "line", label: "Linha", glyph: "———" },
  { value: "dots", label: "Pontos", glyph: "· · ·" },
];

export function captionElement(style) {
  return CAPTION_ELEMENTS.find((element) => element.value === (style?.element || "none"))?.glyph || "";
}

export const CAPTION_COLORS = ["#1A1614", "#8A6A3B", "#B04A5A", "#3B5F8A", "#3F6B4F", "#FFFFFF"];

export const CAPTION_EMOJIS = [
  "❤️", "😍", "✨", "🎉", "🌸", "⭐", "🥂", "🎂",
  "🌿", "☀️", "🕊️", "💫", "📷", "🎞️", "🤍", "😊",
];