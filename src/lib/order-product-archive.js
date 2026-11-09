import { areaFolder } from "./order-paths.js";

function safeName(value, fallback) {
  return String(value ?? "").normalize("NFC")
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, " ")
    .replace(/\s+/g, " ").slice(0, 100).replace(/^[. ]+|[. ]+$/g, "") || fallback;
}

function uniqueName(base, used) {
  let name = base;
  for (let suffix = 2; used.has(name.toLowerCase()); suffix += 1) name = `${base} (${suffix})`;
  used.add(name.toLowerCase());
  return name;
}

function writtenDetails(item) {
  const options = item.options ?? {};
  const lines = Object.entries(options.text_values ?? {})
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([label, value]) => `${label}: ${value.trim()}`);
  for (const [label, value] of [
    ["Descrição", options.description || item.description],
    ["Instruções", options.instructions],
  ]) {
    if (typeof value === "string" && value.trim()) lines.push(`${label}: ${value.trim()}`);
  }
  return lines;
}

function textEntry(name, lines) {
  return { name: `${name}.txt`, text: `${lines.join("\r\n")}\r\n` };
}

function bannerEntries(items, print) {
  const used = new Set();
  return items.flatMap((item) => {
    const options = item.options ?? {};
    const legacySize = item.product_name?.match(/\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?/i)?.[0];
    const size = options.width_cm && options.height_cm ? `${options.width_cm}x${options.height_cm}` : legacySize?.replace(/\s+/g, "").replace(/×/g, "x");
    const title = safeName(size ? `Banner ${size}` : item.product_name, "Banner");
    const name = `${areaFolder("banner")}/${uniqueName(title, used)}`;
    const entries = [];
    if (options.art_file_uri) {
      const fallback = options.art_original_name?.match(/\.([a-z0-9]{1,12})$/i)?.[1] || "bin";
      entries.push({ uri: options.art_file_uri, name, fallback });
    }
    if (print) {
      const legacy = item.variant?.split(" · ").filter(Boolean) ?? [];
      const material = options.material_name ?? (options.material_id ? legacy.shift() : undefined);
      const finishes = options.finish_names ?? legacy;
      entries.push(textEntry(`${name} - Detalhes`, [
        title,
        `Quantidade: ${item.qty || 1}`,
        ...(size ? [`Medidas: ${size} cm`] : []),
        ...(material ? [`Material: ${material}`] : []),
        ...(finishes.length ? [`Acabamento: ${finishes.join(", ")}`] : []),
        `Arte: ${options.art_mode === "equipe" ? "Criação pela equipe" : options.art_file_uri ? "Enviada pelo cliente" : "Sem arquivo registrado"}`,
        ...writtenDetails(item),
      ]));
    }
    return entries;
  });
}

function magnetEntries(items, print) {
  if (!print) return [];
  return items.flatMap((item) => {
    const options = item.options ?? {};
    if (item.options?.magnet_kind !== "strip_kit" || !options.magnet_print_sheet_uri) return [];
    const folder = `${areaFolder("magnet")}/Kit_Tirinhas_5x20`;
    const details = [
      `${item.qty || 1} kit(s) · 3 tirinhas por kit`,
      `Folha de impressão: 15,2 × 20 cm`,
      ...(options.magnet_layout ? [`Montagem: ${options.magnet_layout}`] : []),
    ];
    return [
      { uri: options.magnet_print_sheet_uri, name: `${folder}/Folha_15.2x20`, fallback: "jpg" },
      textEntry(`${folder}/Detalhes_do_kit`, details),
    ];
  });
}

function personalizedEntries(items, photos, originals, prints) {
  const used = new Set();
  const entries = [];
  const groups = new Map(items.map((item) => [item.id, []]));
  const unlinked = [];
  for (const entry of photos) {
    (groups.get(entry.photo.item_id) ?? unlinked).push(entry);
  }

  function addPhotos(folder, pictures) {
    for (const { photo, position } of pictures) {
      const name = `${folder}/Foto ${position} - ${safeName(photo.size_name, "Personalizado")}`;
      const original = originals && photo.original_file_uri;
      if (original) entries.push({ uri: original, name, fallback: "jpg" });
      if (prints && photo.print_file_uri && photo.print_file_uri !== original) {
        entries.push({ uri: photo.print_file_uri, name: `${name} - Impressão`, fallback: "jpg" });
      }
    }
  }

  const includeDetails = originals && prints;
  const category = areaFolder("personalizado");
  const titles = items.map((item) => `${item.qty || 1} ${safeName(item.product_name, "Personalizado")}`);
  const counts = new Map();
  for (const title of titles) {
    const key = title.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [index, item] of items.entries()) {
    const title = titles[index];
    const name = counts.get(title.toLowerCase()) > 1 ? `${title} (Item ${index + 1})` : title;
    const folder = `${category}/${uniqueName(name, used)}`;
    const countBefore = entries.length;
    addPhotos(folder, groups.get(item.id));
    if (includeDetails) {
      const details = writtenDetails(item);
      if (item.variant?.trim()) details.unshift(`Opções: ${item.variant.trim()}`);
      if (details.length) entries.push(textEntry(`${folder}/Detalhes do pedido`, [title, ...details]));
      if (entries.length === countBefore) entries.push({ name: folder });
    }
  }
  addPhotos(`${category}/Sem item identificado`, unlinked);
  return entries;
}

export function orderProductEntries(items, photos, { areas, originals, prints }) {
  const entries = [];
  if (!areas || areas.includes("banner")) {
    entries.push(...bannerEntries(items.filter((item) => item.area === "banner"), prints));
  }
  if (!areas || areas.includes("personalizado")) {
    entries.push(...personalizedEntries(
      items.filter((item) => item.area === "personalizado"),
      photos.filter(({ photo }) => photo.area === "personalizado"),
      originals || areas?.includes("personalizado"),
      prints,
    ));
  }
  if (!areas || areas.includes("magnet")) {
    entries.push(...magnetEntries(items.filter((item) => item.area === "magnet"), prints));
  }
  return entries;
}
