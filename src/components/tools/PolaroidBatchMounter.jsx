import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import CropEditor from "@/components/studio/CropEditor";
import PolaroidPreview from "@/components/studio/PolaroidPreview";
import { PHOTO_ACCEPT } from "@/lib/upload-formats";
import { openToolImage } from "@/components/tools/open-tool-image";
import { drawPolaroid, photoSizeMetrics } from "@/lib/photo";
import { ensureCaptionFont } from "@/lib/caption-style";

const DPI = 300;
const MAX_FILES = 100;
const FORMATS = {
  "5x7": { width: 5, height: 7, label: "Baby · 5 × 7 cm", folder: "Polaroides_5x7" },
  "7x9": { width: 7, height: 9, label: "Mini · 7 × 9 cm", folder: "Polaroides_7x9" },
  "9x11": { width: 9, height: 11, outputHeight: 12.7, label: "Normal · 9 × 11 cm", folder: "Polaroides_9x11_em_9x12-7" },
};
const toPx = (cm) => Math.max(1, Math.round((cm * DPI) / 2.54));
const safeName = (value) => String(value || "polaroide")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_")
  .replace(/^_+|_+$/g, "").slice(0, 80) || "polaroide";

async function setJpegResolution(blob, dpi) {
  const source = new Uint8Array(await blob.arrayBuffer());
  if (source[0] !== 0xff || source[1] !== 0xd8) throw new Error("O arquivo JPEG gerado está inválido.");
  const density = Math.max(1, Math.min(65535, Math.round(dpi)));
  const hasJfif = source[2] === 0xff && source[3] === 0xe0
    && source[6] === 0x4a && source[7] === 0x46 && source[8] === 0x49 && source[9] === 0x46 && source[10] === 0;
  if (hasJfif) {
    source[13] = 1;
    source[14] = density >> 8; source[15] = density & 0xff;
    source[16] = density >> 8; source[17] = density & 0xff;
    return new Blob([source], { type: "image/jpeg" });
  }
  const marker = new Uint8Array([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01,
    density >> 8, density & 0xff, density >> 8, density & 0xff, 0x00, 0x00]);
  const output = new Uint8Array(source.length + marker.length);
  output.set(source.slice(0, 2)); output.set(marker, 2); output.set(source.slice(2), 2 + marker.length);
  return new Blob([output], { type: "image/jpeg" });
}

function PolaroidThumbnail({ photo, model, format }) {
  const outputHeight = format.outputHeight || format.height;
  return (
    <div className="relative mx-auto w-full max-w-[112px] overflow-hidden border border-border bg-black shadow-sm"
      style={{ aspectRatio: `${format.width} / ${outputHeight}` }}>
      <div className="absolute inset-x-0 top-0" style={{ height: `${format.height / outputHeight * 100}%` }}>
        <PolaroidPreview photo={photo} model={model} width={112} squareCorners />
      </div>
    </div>
  );
}

export default function PolaroidBatchMounter({ publicMode = false }) {
  const [formatKey, setFormatKey] = useState("5x7");
  const [entries, setEntries] = useState([]);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [editingEntryId, setEditingEntryId] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const active = useRef(true);
  const running = useRef(false);
  const objectUrls = useRef(new Set());
  const format = FORMATS[formatKey];
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) || entries[0] || null;
  const model = useMemo(() => ({
    id: formatKey,
    name: format.label,
    width_cm: format.width,
    height_cm: format.height,
    has_caption: true,
    frame_color: "#ffffff",
    dpi: DPI,
    price: 0,
  }), [formatKey, format]);
  const editorPhotos = entries.map((entry) => ({
    ...entry,
    ...photoSizeMetrics(model, "polaroid", entry),
    area: "polaroid",
    sizeId: formatKey,
    sizeLabel: model.name,
    model,
  }));
  const editingIndex = editorPhotos.findIndex((entry) => entry.id === editingEntryId);
  const editingPhoto = editingIndex >= 0 ? editorPhotos[editingIndex] : null;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    };
  }, []);

  async function addFiles(list) {
    const selected = Array.from(list || []);
    const room = Math.max(0, MAX_FILES - entries.length);
    if (selected.length > room) toast.warning(`O lote aceita até ${MAX_FILES} fotos.`);
    const files = selected.slice(0, room);
    if (!files.length) return;
    setPreparing(true);
    const accepted = [];
    try {
      for (const [index, file] of files.entries()) {
        try {
          const { url, image } = await openToolImage(file);
          if (!active.current) { URL.revokeObjectURL(url); return; }
          objectUrls.current.add(url);
          const id = `${file.name}-${file.size}-${Date.now()}-${index}`;
          const photo = { w: image.naturalWidth, h: image.naturalHeight };
          accepted.push({
            id, file, name: file.name, preview: url, ...photo,
            area: "polaroid", fit: "cover", zoom: 1, ox: 0, oy: 0,
            rotation: 0, flipH: false, flipV: false, colorEffect: "none",
            caption: "", captionStyle: { font: "hand", size: 0.062, color: "#1A1614", align: "center" },
          });
        } catch {
          toast.error(`Não foi possível abrir a foto ${file.name}.`);
        }
      }
      if (accepted.length && active.current) {
        setEntries((current) => [...current, ...accepted]);
        setSelectedEntryId(accepted[0].id);
      }
    } finally {
      if (active.current) setPreparing(false);
    }
  }

  function removeEntry(id) {
    if (running.current) return;
    const removed = entries.find((entry) => entry.id === id);
    if (removed?.preview) {
      URL.revokeObjectURL(removed.preview);
      objectUrls.current.delete(removed.preview);
    }
    const remaining = entries.filter((entry) => entry.id !== id);
    setEntries(remaining);
    if (selectedEntryId === id) setSelectedEntryId(remaining[0]?.id || "");
  }

  function clearEntries() {
    if (running.current) return;
    entries.forEach((entry) => {
      URL.revokeObjectURL(entry.preview);
      objectUrls.current.delete(entry.preview);
    });
    setEntries([]);
    setSelectedEntryId("");
  }

  async function buildZip() {
    if (!entries.length || running.current) return;
    running.current = true;
    setBusy(true);
    setProgress({ done: 0, total: entries.length });
    let currentName = "";
    try {
      const { zipSync } = await import("fflate");
      const archiveFiles = {};
      const usedNames = new Set();
      for (const [index, entry] of entries.entries()) {
        if (!active.current) return;
        currentName = entry.name;
        const { url, image } = await openToolImage(entry.file);
        try {
          await ensureCaptionFont(entry.captionStyle);
          const polaroidCanvas = document.createElement("canvas");
          polaroidCanvas.width = toPx(format.width);
          polaroidCanvas.height = toPx(format.height);
          const polaroidContext = polaroidCanvas.getContext("2d");
          if (!polaroidContext) throw new Error("Não foi possível preparar o arquivo de impressão.");
          drawPolaroid(polaroidContext, image, entry, polaroidCanvas.width, polaroidCanvas.height, model);

          let outputCanvas = polaroidCanvas;
          if (format.outputHeight) {
            outputCanvas = document.createElement("canvas");
            outputCanvas.width = toPx(format.width);
            outputCanvas.height = toPx(format.outputHeight);
            const outputContext = outputCanvas.getContext("2d", { alpha: false });
            if (!outputContext) throw new Error("Não foi possível preparar a faixa preta do arquivo.");
            outputContext.fillStyle = "#000000";
            outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
            outputContext.drawImage(polaroidCanvas, 0, 0);
            polaroidCanvas.width = 0;
            polaroidCanvas.height = 0;
          }
          const blob = await setJpegResolution(await new Promise((resolve, reject) => outputCanvas.toBlob((value) => {
            outputCanvas.width = 0;
            outputCanvas.height = 0;
            if (value) resolve(value);
            else reject(new Error("Não foi possível gerar uma Polaroide."));
          }, "image/jpeg", 0.96)), DPI);
          const base = safeName(entry.name);
          let filename = `${base}.jpg`;
          for (let duplicate = 2; usedNames.has(filename.toLowerCase()); duplicate += 1) filename = `${base}_${duplicate}.jpg`;
          usedNames.add(filename.toLowerCase());
          archiveFiles[`${format.folder}/${filename}`] = new Uint8Array(await blob.arrayBuffer());
        } finally {
          URL.revokeObjectURL(url);
        }
        setProgress({ done: index + 1, total: entries.length });
      }
      if (!active.current) return;
      const archive = zipSync(archiveFiles, { level: 0 });
      const downloadUrl = URL.createObjectURL(new Blob([archive], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Paracolor_Polaroides_${formatKey.replace("x", "-")}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
      toast.success(`ZIP gerado com ${entries.length} Polaroide(s).`);
    } catch (error) {
      if (active.current) toast.error(error?.message || `Não foi possível montar ${currentName || "o lote"}.`);
    } finally {
      running.current = false;
      if (active.current) {
        setBusy(false);
        setProgress({ done: 0, total: 0 });
      }
    }
  }

  return (
    <section className="card-glass rounded-none p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-body text-lg font-semibold tracking-normal"><ImagePlus className="h-5 w-5" /> Montador de Polaroides em lote</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Selecione o formato, envie as fotos, confira as miniaturas e ajuste o enquadramento de cada imagem antes de baixar o ZIP. Tudo é processado neste navegador.
          </p>
        </div>
        {entries.length > 0 && <Button type="button" variant="outline" size="sm" onClick={clearEntries} disabled={busy || preparing}>Limpar lote</Button>}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {Object.entries(FORMATS).map(([key, item]) => (
          <button key={key} type="button" onClick={() => setFormatKey(key)} disabled={busy || preparing || Boolean(editingEntryId)} aria-pressed={formatKey === key}
            className={`rounded-none border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${formatKey === key ? "border-primary bg-accent/50" : "border-border bg-card hover:border-gold/70"}`}>
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="mt-1 block text-[11px] text-muted-foreground">{key === "9x11" ? "Saída 9 × 12,7 cm · faixa preta embaixo" : `Arquivo final ${item.width} × ${item.height} cm`}</span>
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Depois de adicionar as fotos, toque no lápis de cada miniatura para usar o mesmo editor de enquadramento e escrita do envio normal de Polaroides.</p>

      <label className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-none border border-dashed border-gold/60 px-4 py-7 text-center text-sm text-muted-foreground transition hover:border-gold hover:bg-gold-soft/20 ${preparing || entries.length >= MAX_FILES ? "pointer-events-none opacity-60" : ""}`}>
        {preparing ? <LoaderCircle className="mb-2 h-5 w-5 animate-spin text-gold-deep" /> : <ImagePlus className="mb-2 h-5 w-5 text-gold-deep" />}
        <span>{preparing ? "Preparando miniaturas…" : "Adicionar fotos ao lote · JPG, PNG, WebP ou HEIC"}</span>
        <input type="file" accept={PHOTO_ACCEPT} multiple disabled={busy || preparing || entries.length >= MAX_FILES} className="sr-only"
          onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} />
      </label>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{entries.length} de {MAX_FILES} fotos no lote</span>
        {busy && <span role="status" className="inline-flex items-center gap-1.5"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Montando {progress.done}/{progress.total}…</span>}
      </div>
      {entries.length > 0 && <>
        <div className="mt-3 grid max-h-72 grid-cols-2 gap-3 overflow-y-auto rounded-none border border-border bg-card/60 p-3 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map((entry, index) => <div key={entry.id} className={`relative min-w-0 rounded-none border p-2 transition ${selectedEntry?.id === entry.id ? "border-primary bg-accent/50 ring-2 ring-primary/15" : "border-border bg-background hover:border-gold/70"}`}>
            <button type="button" onClick={() => setSelectedEntryId(entry.id)} disabled={busy}
              aria-pressed={selectedEntry?.id === entry.id}
              aria-label={`Selecionar foto ${index + 1} para editar o enquadramento`}
              className="block w-full min-w-0 text-left">
              <PolaroidThumbnail photo={editorPhotos[index]} model={model} format={format} />
              <span className="mt-2 flex min-w-0 items-center gap-1.5 pr-7 text-xs font-medium">
                <span className="shrink-0 text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate" title={entry.name}>{entry.name}</span>
                <span className="sr-only">Toque para selecionar</span>
              </span>
            </button>
            <button type="button" onClick={() => { setSelectedEntryId(entry.id); setEditingEntryId(entry.id); }} disabled={busy || preparing}
              aria-label={`Editar ${entry.name}`} title="Editar enquadramento e escrita"
              className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-none border border-border bg-background/95 text-muted-foreground shadow-sm transition hover:text-primary disabled:opacity-40">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => removeEntry(entry.id)} disabled={busy || preparing}
              aria-label={`Remover ${entry.name}`} title="Remover foto"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-none border border-border bg-background/95 text-muted-foreground shadow-sm transition hover:text-destructive disabled:opacity-40">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>)}
        </div>

      </>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {formatKey === "9x11" ? "Cada arquivo terá 9 × 12,7 cm: Polaroide 9 × 11 cm no alto e faixa preta de 1,7 cm embaixo." : `Cada arquivo será montado no tamanho ${format.width} × ${format.height} cm, com foto quadrada, moldura branca e área inferior para legenda.`}
        </p>
        <Button type="button" onClick={buildZip} disabled={busy || preparing || entries.length === 0} className="shrink-0 rounded-none">
          {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Baixar ZIP
        </Button>
      </div>
      {publicMode && <p className="mt-3 text-[10px] text-muted-foreground">As imagens permanecem no seu dispositivo durante a montagem.</p>}
      {editingPhoto && <CropEditor
        photo={editingPhoto}
        sizes={[model]}
        mode="polaroid"
        index={editingIndex}
        total={editorPhotos.length}
        previousId={editorPhotos[editingIndex - 1]?.id}
        nextId={editorPhotos[editingIndex + 1]?.id}
        onClose={() => setEditingEntryId("")}
        onSave={(updated, options, nextId) => {
          setEditingEntryId(nextId || "");
          if (!updated) return;
          setEntries((current) => current.map((entry) => {
            if (entry.id === updated.id) return { ...entry, ...updated };
            let next = entry;
            if (options?.applyCaptionAll) next = { ...next, caption: updated.caption || "", captionStyle: updated.captionStyle || {} };
            if (options?.applyCropAll) next = {
              ...next,
              fit: updated.fit, zoom: updated.zoom, ox: updated.ox, oy: updated.oy,
              rotation: updated.rotation, flipH: updated.flipH, flipV: updated.flipV,
            };
            return next;
          }));
        }}
      />}
    </section>
  );
}
