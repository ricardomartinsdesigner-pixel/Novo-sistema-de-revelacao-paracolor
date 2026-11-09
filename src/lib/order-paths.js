/**
 * Organização dos arquivos de produção de um pedido.
 * Revelação e Polaroides: PEDIDO/<Categoria>/<Tamanho ou modelo> [N cópias]/arquivo.jpg
 */

const AREA_FOLDERS = {
  revelacao: "Fotos_Impressao",
  polaroid: "Polaroids",
  magnet: "Fotos_Imas",
  banner: "Banner",
  personalizado: "Personalizados",
  moldura: "Molduras",
};

const POLAROID_MODELS = new Map([
  ["5x7", "Baby"],
  ["7x9", "Mini"],
  ["9x11", "Normal"],
]);

export const AREA_LABELS = {
  revelacao: "Revelação",
  polaroid: "Polaroides",
  magnet: "Fotos Ímã",
  banner: "Banners",
  personalizado: "Personalizados",
  moldura: "Molduras",
};

export function pad(value) {
  return String(value).padStart(3, "0");
}

function clean(value, fallback) {
  const text = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9xX_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return text || fallback;
}

/**
 * Número usado na operação (pastas, ZIP, fichas): o número interno da loja
 * quando o atendente preenche, senão o número gerado pelo site.
 */
export function orderLabel(order) {
  return String(order?.internal_number || "").trim() || order?.order_number || "";
}

export function areaFolder(area) {
  return AREA_FOLDERS[area] || "Fotos_Impressao";
}

export function sizeLabel(photo) {
  if (photo.size_name) return String(photo.size_name).trim();
  if (photo.width_cm && photo.height_cm) return `${photo.width_cm}x${photo.height_cm}`;
  return "Sem_tamanho";
}

export function copiesOf(photo) {
  return Math.max(1, Math.round(Number(photo.copies) || 1));
}

export function copiesFolder(photo) {
  const copies = copiesOf(photo);
  return `${copies}_${copies === 1 ? "COPIA" : "COPIAS"}`;
}

export function photoFolder(photo) {
  const area = areaFolder(photo.area);
  const size = sizeLabel(photo);
  const safeSize = clean(size, "Sem_tamanho");
  if (photo.area !== "revelacao" && photo.area !== "polaroid") {
    return `${area}/${safeSize}/${copiesFolder(photo)}`;
  }

  const dimensions = size.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i)
    ?.slice(1).map((value) => Number(value.replace(",", ".")));
  const width = Number(photo.width_cm);
  const height = Number(photo.height_cm);
  const measured = width > 0 && height > 0 ? [width, height] : null;
  let folder = (dimensions ?? measured)?.join("x") ?? safeSize;
  if (photo.area === "polaroid") {
    const measuredSize = measured?.sort((a, b) => a - b).join("x");
    const namedSize = dimensions?.sort((a, b) => a - b).join("x");
    const model = POLAROID_MODELS.get(measuredSize) ?? POLAROID_MODELS.get(namedSize);
    folder = model ? `Polaroide ${model}` : safeSize;
  }

  const copies = copiesOf(photo);
  return `${area}/${folder}${copies > 1 ? ` ${copies} cópias` : ""}`;
}

export function photoPrefix(photo) {
  if (photo.area === "polaroid") return "POLAROID";
  if (photo.area === "magnet") return "IMA";
  if (photo.area === "banner") return "BANNER";
  return "FOTO";
}

/**
 * Texto enviado dentro do ZIP com o resumo de produção e a listagem das pastas.
 */
export function buildProductionManifest({ order, printPlan = [], originalsCount = 0 }) {
  const folders = new Map();
  for (const entry of printPlan) {
    if (!folders.has(entry.folder)) folders.set(entry.folder, []);
    folders.get(entry.folder).push(entry);
  }

  const rows = [];
  for (const [folder, entries] of folders) {
    const first = entries[0].photo;
    const copies = copiesOf(first);
    rows.push({
      folder,
      area: AREA_LABELS[first.area] || first.area,
      size: sizeLabel(first),
      copies,
      files: entries.length,
      sheets: entries.length * copies,
    });
  }

  const sheets = rows.reduce((sum, row) => sum + row.sheets, 0);
  const generated = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const lines = [
    `PEDIDO ${orderLabel(order)}`,
    `Cliente: ${order.customer_name || ""}`,
    `Gerado em: ${generated}`,
    "",
    "RESUMO DE PRODUÇÃO",
    ...rows.map(
      (row) =>
        `${row.area} · ${row.size} · ${row.copies} ${row.copies === 1 ? "cópia" : "cópias"} — ${row.files} foto(s), ${row.sheets} folha(s)`
    ),
    `Total de arquivos de impressão: ${printPlan.length}`,
    `Total de folhas (com cópias): ${sheets}`,
  ];
  if (originalsCount) lines.push(`Fotos originais incluídas: ${originalsCount}`);

  lines.push("", "PASTAS");
  for (const [folder, entries] of folders) {
    lines.push(`${folder} (${entries.length} arquivo(s))`);
    for (const entry of entries) {
      lines.push(`  - ${entry.fileName}${entry.photo.filename ? ` <- ${entry.photo.filename}` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
