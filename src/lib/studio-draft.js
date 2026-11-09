const STORAGE_PREFIX = "paracolor:ajustes:";

const FIELDS = [
  "sizeId", "sizeLabel", "wCm", "hCm", "price", "borderPrice", "polaroidModel",
  "aspect", "printW", "printH", "dpi", "sourceOrientation", "printOrientation",
  "fit", "border", "zoom", "ox", "oy", "rotation", "flipH", "flipV", "copies",
  "caption", "captionStyle", "captionAreaEnabled", "colorEffect",
];

const storage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/**
 * Rascunho dos ajustes do estúdio. Guarda por foto (assinatura do arquivo) o
 * formato, o enquadramento, a borda, as cópias e a legenda. Se a página for
 * recarregada ou o navegador fechar, reenviar as mesmas fotos devolve tudo.
 */
export function readAdjustments(mode) {
  const store = storage();
  if (!store) return {};
  try {
    const parsed = JSON.parse(store.getItem(`${STORAGE_PREFIX}${mode}`) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function pickAdjustments(photo) {
  return FIELDS.reduce((acc, field) => {
    if (photo[field] !== undefined) acc[field] = photo[field];
    return acc;
  }, {});
}

export function saveAdjustments(mode, photos) {
  const store = storage();
  if (!store) return;
  const map = {};
  for (const photo of photos) {
    if (!photo.signature || photo.status !== "ready") continue;
    map[photo.signature] = pickAdjustments(photo);
  }
  try {
    store.setItem(`${STORAGE_PREFIX}${mode}`, JSON.stringify(map));
  } catch {
    // Cota cheia: o rascunho é um conforto, nunca bloqueia o pedido.
  }
}

export function clearAdjustments(mode) {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(`${STORAGE_PREFIX}${mode}`);
  } catch {
    // ignora
  }
}
const UPLOAD_PREFIX = "paracolor:envio:v1:";

export function readUploadDraft(userId, mode) {
  if (!userId) return [];
  try {
    const data = JSON.parse(storage()?.getItem(`${UPLOAD_PREFIX}${userId}:${mode}`) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveUploadDraft(userId, mode, photos) {
  if (!userId) return;
  try {
    const store = storage();
    const key = `${UPLOAD_PREFIX}${userId}:${mode}`;
    if (photos.length) {
      const records = photos.map(({ preview: _preview, model: _model, ...photo }) => photo);
      store?.setItem(key, JSON.stringify(records));
    } else {
      store?.removeItem(key);
    }
  } catch {
    // O navegador pode bloquear o armazenamento local.
  }
}

export function draftFileId(uri) {
  return typeof uri === "string" && /^vps:[0-9a-f-]{36}$/i.test(uri) ? uri.slice(4) : "";
}
