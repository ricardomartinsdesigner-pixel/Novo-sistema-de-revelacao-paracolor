const SIMILARITY_DISTANCE = 6;

function isPdf(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

async function contentFingerprint(file) {
  if (!globalThis.crypto?.subtle) return "";
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function visualFingerprint(file) {
  if (isPdf(file) || typeof document === "undefined") return "";
  let bitmap;
  let url;
  try {
    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(file);
    } else {
      url = URL.createObjectURL(file);
      bitmap = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });
    }
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return "";
    context.drawImage(bitmap, 0, 0, 9, 8);
    const pixels = context.getImageData(0, 0, 9, 8).data;
    let bits = 0n;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const left = (y * 9 + x) * 4;
        const right = left + 4;
        const grayLeft = pixels[left] * 0.299 + pixels[left + 1] * 0.587 + pixels[left + 2] * 0.114;
        const grayRight = pixels[right] * 0.299 + pixels[right + 1] * 0.587 + pixels[right + 2] * 0.114;
        if (grayLeft > grayRight) bits |= 1n << BigInt(y * 8 + x);
      }
    }
    return bits.toString(16).padStart(16, "0");
  } catch {
    return "";
  } finally {
    bitmap?.close?.();
    if (url) URL.revokeObjectURL(url);
  }
}

function hammingDistance(left, right) {
  if (!left || !right) return Infinity;
  let bits = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let distance = 0;
  while (bits) {
    distance += Number(bits & 1n);
    bits >>= 1n;
  }
  return distance;
}

/** Runs locally in the browser; source images are not uploaded by this helper. */
export async function analyzePhotoDuplicates(files, existingPhotos = [], onProgress = () => {}) {
  const entries = [];
  const total = files.length;
  for (let index = 0; index < total; index += 1) {
    const file = files[index];
    let contentHash = "";
    try {
      contentHash = await contentFingerprint(file);
    } catch {
      // The visual fingerprint can still detect an identical-looking image.
    }
    const visualHash = await visualFingerprint(file);
    entries.push({
      id: `incoming-${index}`,
      file,
      contentHash,
      visualHash,
      exactGroup: "",
      exactMatches: [],
      similarMatches: [],
    });
    onProgress(index + 1, total);
  }

  const exactGroups = new Map();
  for (const entry of entries) {
    if (!entry.contentHash) continue;
    const group = exactGroups.get(entry.contentHash) || [];
    group.push(entry);
    exactGroups.set(entry.contentHash, group);
  }
  for (const [hash, group] of exactGroups) {
    const existing = existingPhotos.filter((photo) => photo.contentHash && photo.contentHash === hash);
    if (group.length < 2 && !existing.length) continue;
    group.forEach((entry) => {
      entry.exactGroup = `sha256-${hash}`;
      entry.exactMatches = [
        ...group.filter((other) => other.id !== entry.id).map((other) => ({ name: other.file.name, existing: false })),
        ...existing.map((photo) => ({ name: photo.name || "Foto já adicionada", existing: true })),
      ];
    });
  }

  for (const entry of entries) {
    if (!entry.contentHash) {
      const signature = `${entry.file.name}|${entry.file.size}|${entry.file.lastModified}`;
      const existing = existingPhotos.filter((photo) => !photo.contentHash && photo.signature === signature);
      if (existing.length) {
        entry.exactGroup = `legacy-${signature}`;
        entry.exactMatches = existing.map((photo) => ({ name: photo.name || "Foto já adicionada", existing: true }));
      }
    }
  }

  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    const left = entries[leftIndex];
    if (!left.visualHash) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const right = entries[rightIndex];
      if (!right.visualHash || (left.contentHash && left.contentHash === right.contentHash)) continue;
      const distance = hammingDistance(left.visualHash, right.visualHash);
      if (distance <= SIMILARITY_DISTANCE) {
        left.similarMatches.push({ name: right.file.name, distance, existing: false });
        right.similarMatches.push({ name: left.file.name, distance, existing: false });
      }
    }
    for (const photo of existingPhotos) {
      if (!photo.visualHash || (left.contentHash && left.contentHash === photo.contentHash)) continue;
      const distance = hammingDistance(left.visualHash, photo.visualHash);
      if (distance <= SIMILARITY_DISTANCE) {
        left.similarMatches.push({ name: photo.name || "Foto já adicionada", distance, existing: true });
      }
    }
  }

  return entries;
}

export function keepOnePerExactGroup(entries, selectedIds) {
  const selected = new Set(selectedIds);
  const groups = new Map();
  for (const entry of entries) {
    if (!entry.exactGroup) continue;
    const group = groups.get(entry.exactGroup) || [];
    group.push(entry);
    groups.set(entry.exactGroup, group);
  }
  for (const group of groups.values()) {
    if (group.some((entry) => entry.exactMatches.some((match) => match.existing))) {
      group.forEach((entry) => selected.delete(entry.id));
      continue;
    }
    const keep = group.find((entry) => selected.has(entry.id)) || group[0];
    group.forEach((entry) => (entry.id === keep.id ? selected.add(entry.id) : selected.delete(entry.id)));
  }
  return [...selected];
}
