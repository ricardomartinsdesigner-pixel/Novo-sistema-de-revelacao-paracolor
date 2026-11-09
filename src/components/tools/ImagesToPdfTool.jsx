import { useEffect, useRef, useState } from "react";
import { Images } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import OrganizerList from "@/components/tools/OrganizerList";
import { openToolImage } from "@/components/tools/open-tool-image";
import { canvasToBlob, loadImage } from "@/lib/photo";
import { PRINT_TARGET_PPI } from "@/lib/print-resolution";
import { PHOTO_ACCEPT } from "@/lib/upload-formats";

const MAX_FILES = 100;
const MAX_SIDE = 4096;
const PAGE_SIZES = [
  { value: "a4", label: "A4 retrato" },
  { value: "landscape", label: "A4 paisagem" },
  { value: "auto", label: "Proporção da foto" },
];

export default function ImagesToPdfTool() {
  const urls = useRef(new Set());
  const active = useRef(false);
  const running = useRef(false);
  const [items, setItems] = useState([]);
  const [pageSize, setPageSize] = useState("a4");
  const [progress, setProgress] = useState(null);
  const [rejected, setRejected] = useState([]);
  const busy = Boolean(progress);

  useEffect(() => {
    const previews = urls.current;
    active.current = true;
    return () => {
      active.current = false;
      previews.forEach((url) => URL.revokeObjectURL(url));
      previews.clear();
    };
  }, []);

  async function addImages(files) {
    if (running.current) return;
    const selected = Array.from(files || []);
    const pending = selected.slice(0, MAX_FILES - items.length);
    if (selected.length > pending.length) toast.warning(`O PDF pode ter até ${MAX_FILES} páginas.`);
    if (!pending.length) return;
    running.current = true;
    const loaded = [];
    const failed = [];
    setProgress({ label: "Abrindo imagens", done: 0, total: pending.length });
    try {
      for (const [index, file] of pending.entries()) {
        try {
          const { url } = await openToolImage(file);
          if (!active.current) {
            URL.revokeObjectURL(url);
            return;
          }
          urls.current.add(url);
          loaded.push({ key: url, name: file.name, url });
        } catch {
          if (!active.current) return;
          failed.push(file.name);
        }
        setProgress({ label: "Abrindo imagens", done: index + 1, total: pending.length });
      }
      setItems((current) => [...current, ...loaded]);
      setRejected(failed);
    } finally {
      running.current = false;
      if (active.current) setProgress(null);
    }
  }

  function move(index, direction) {
    if (running.current) return;
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index) {
    if (running.current) return;
    const url = items[index]?.url;
    if (urls.current.delete(url)) URL.revokeObjectURL(url);
    setItems((current) => current.filter((_, position) => position !== index));
  }

  function clearAll() {
    if (running.current) return;
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
    setItems([]);
    setRejected([]);
  }

  async function build() {
    if (!items.length || running.current) return;
    running.current = true;
    setProgress({ label: "Montando o PDF", done: 0, total: items.length });
    const canvas = document.createElement("canvas");
    let page = "";
    try {
      const { jsPDF } = await import("jspdf");
      let pdf;

      for (const [index, item] of items.entries()) {
        if (!active.current) return;
        page = item.name;
        const image = await loadImage(item.url);
        if (!active.current) return;
        const { naturalWidth: iw, naturalHeight: ih } = image;
        const orientation = pageSize === "auto" ? (ih >= iw ? "portrait" : "landscape")
          : pageSize === "landscape" ? "landscape" : "portrait";
        const mmPerPixel = Math.min(25.4 / 96, 5000 / Math.max(iw, ih));
        const format = pageSize === "auto" ? [iw * mmPerPixel, ih * mmPerPixel] : "a4";
        if (!pdf) pdf = new jsPDF({ unit: "mm", format, orientation });
        else pdf.addPage(format, orientation);

        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = pageSize === "auto" ? 0 : 10;
        const scale = Math.min((pageW - margin * 2) / iw, (pageH - margin * 2) / ih);
        const width = iw * scale;
        const height = ih * scale;
        const rasterScale = Math.min(1, MAX_SIDE / Math.max(iw, ih), scale * PRINT_TARGET_PPI / 25.4);
        canvas.width = Math.max(1, Math.round(iw * rasterScale));
        canvas.height = Math.max(1, Math.round(ih * rasterScale));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.92);
        if (!active.current) return;
        pdf.addImage(new Uint8Array(await jpeg.arrayBuffer()), "JPEG", (pageW - width) / 2, (pageH - height) / 2, width, height);
        setProgress({ label: "Montando o PDF", done: index + 1, total: items.length });
      }

      pdf.save("paracolor-fotos.pdf");
      toast.success(`PDF gerado com ${items.length} página(s).`);
    } catch {
      if (active.current) toast.error(page ? `Não foi possível montar a página de ${page}. Tente com um lote menor ou remova esta imagem.`
        : "Não foi possível montar o PDF. Tente novamente.");
    } finally {
      canvas.width = canvas.height = 0;
      running.current = false;
      if (active.current) setProgress(null);
    }
  }

  const list = items.map((item) => ({ key: item.key, label: item.name, thumb: item.url }));

  return (
    <section className="card-glass p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Images className="h-4 w-4" /> Fotos em PDF em lote
      </h2>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Misture JPG, PNG, HEIC e WebP no mesmo PDF. Cada imagem vira uma página. Organize a ordem pelas setas.
      </p>

      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gold/60 px-3 py-6 text-xs text-muted-foreground hover:border-gold hover:bg-gold-soft/25">
        <Images className="h-4 w-4" /> Adicionar fotos
        <input type="file" accept={PHOTO_ACCEPT} multiple disabled={busy || items.length >= MAX_FILES} className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            void addImages(files);
          }}
        />
      </label>
      <p className="mt-2 text-[11px] text-muted-foreground">{items.length} de {MAX_FILES} páginas no lote</p>
      {progress && <p role="status" className="mt-2 text-xs text-muted-foreground">{progress.label} · {progress.done} de {progress.total}</p>}
      {rejected.length > 0 && <details className="mt-2 text-xs text-destructive">
        <summary className="cursor-pointer">{rejected.length} imagem(ns) que não abriram</summary>
        <ul className="mt-1 space-y-1">{rejected.map((name, index) => <li key={index} className="break-words">{name}</li>)}</ul>
      </details>}

      <OrganizerList items={list} onMove={move} onRemove={remove} disabled={busy} emptyLabel="Adicione as imagens que vão virar páginas." />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <select value={pageSize} aria-label="Formato da página do PDF" disabled={busy} onChange={(event) => setPageSize(event.target.value)}
          className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs">
          {PAGE_SIZES.map((size) => <option key={size.value} value={size.value}>{size.label}</option>)}
        </select>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={clearAll} disabled={(!items.length && !rejected.length) || busy}>Limpar</Button>
          <Button size="sm" onClick={build} disabled={!items.length || busy}>Gerar PDF</Button>
        </div>
      </div>
    </section>
  );
}
