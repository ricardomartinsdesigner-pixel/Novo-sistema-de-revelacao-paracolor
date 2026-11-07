/**
 * Organização dos arquivos de produção de um pedido.
 * Estrutura: PEDIDO/<Categoria>/<Tamanho>/<N>_COPIA(S)/arquivo.jpg
 */

const AREA_FOLDERS = {
  revelacao: "Fotos_Impressao",
  polaroid: "Polaroids",
  banner: "Banners",
  personalizado: "Personalizados",
  moldura: "Molduras",
};

export const AREA_LABELS = {
  revelacao: "Revelação",
  polaroid: "Polaroides",
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
  return `${areaFolder(photo.area)}/${clean(sizeLabel(photo), "Sem_tamanho")}/${copiesFolder(photo)}`;
}

export function photoPrefix(photo) {
  if (photo.area === "polaroid") return "POLAROID";
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