import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { canvasToBlob, loadImage } from "@/lib/photo";
import { convertHeicToJpeg, isHeicFile } from "@/lib/heic";

const MAX_FILES = 300;

async function toJpeg(file) {
  if (isHeicFile(file)) {
    const jpeg = await convertHeicToJpeg(file);
    return { blob: jpeg, name: jpeg.name };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return { blob: await canvasToBlob(canvas, "image/jpeg", 0.92), name: file.name.replace(/\.[^.]+$/, ".jpg") };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function HeicBatchTool() {
  const files = useRef(new Map());
  const urls = useRef(new Map());
  const active = useRef(false);
  const [items, setItems] = useState([]);
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);

  function clearFiles() {
    files.current.clear();
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
  }

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; clearFiles(); };
  }, []);

  function selectFiles(selected) {
    const list = Array.from(selected || []);
    if (list.length > MAX_FILES) toast(`Selecionamos as primeiras ${MAX_FILES} fotos do lote.`);
    const accepted = list.slice(0, MAX_FILES);
    clearFiles();
    setProcessed(0);
    setItems(
      accepted.map((file) => {
        const key = `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
        files.current.set(key, file);
        return { key, name: file.name.replace(/\.[^.]+$/, ".jpg"), status: "pending", url: "" };
      })
    );
  }

  async function convertAll() {
    if (!items.length || running) return;
    setRunning(true);
    setProcessed(0);
    try {
      for (const [index, item] of items.entries()) {
        try {
          const { blob, name } = await toJpeg(files.current.get(item.key));
          if (!active.current) return;
          const previous = urls.current.get(item.key);
          if (previous) URL.revokeObjectURL(previous);
          const url = URL.createObjectURL(blob);
          urls.current.set(item.key, url);
          setItems((current) => current.map((row) => (row.key === item.key ? { ...row, status: "done", url, name } : row)));
        } catch {
          if (!active.current) return;
          setItems((current) => current.map((row) => (row.key === item.key ? { ...row, status: "error" } : row)));
        }
        setProcessed(index + 1);
      }
      toast.success("Conversão concluída. Baixe as fotos convertidas.");
    } finally {
      setRunning(false);
    }
  }

  async function downloadAll() {
    const ready = items.filter((item) => item.status === "done");
    for (const item of ready) {
      const link = document.createElement("a");
      link.href = item.url;
      link.download = item.name;
      link.click();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  const ready = items.filter((item) => item.status === "done").length;
  const failed = items.filter((item) => item.status === "error").length;
  const percent = items.length ? Math.round((processed / items.length) * 100) : 0;

  return (
    <section className="card-glass p-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Smartphone className="h-4 w-4" /> HEIC para JPG em lote
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Selecione até 300 fotos do iPhone de uma vez. Todas são convertidas para JPG no próprio navegador.
      </p>

      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gold/60 px-3 py-6 text-xs text-muted-foreground hover:border-gold hover:bg-gold-soft/25">
        <Smartphone className="h-4 w-4" /> Escolher fotos ({MAX_FILES} no máximo)
        <input
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          disabled={running}
          className="hidden"
          onChange={(event) => {
            selectFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>

      {items.length ? (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {running ? `Convertendo ${processed} de ${items.length}…` : `${ready} de ${items.length} convertida(s)`}
            {failed ? ` · ${failed} com erro` : ""}
          </p>

          <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.key} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
                <span className="w-4 shrink-0 text-center text-[10px] text-muted-foreground">
                  {item.status === "done" ? "✓" : item.status === "error" ? "!" : "•"}
                </span>
                <p className="min-w-0 flex-1 truncate text-[11px]">
                  {item.status === "done" ? item.name : item.name.replace(/\.jpg$/, ".heic")}
                </p>
                {item.status === "pending" ? <Loader2 className={`h-3 w-3 shrink-0 ${running ? "animate-spin text-gold" : "text-muted-foreground/40"}`} /> : null}
                {item.status === "error" ? <span className="shrink-0 text-[10px] text-red-600">não abriu</span> : null}
                {item.status === "done" ? (
                  <a href={item.url} download={item.name} className="shrink-0 text-[11px] font-medium text-gold-deep hover:underline">
                    baixar
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => { clearFiles(); setItems([]); }} disabled={!items.length || running}>Limpar</Button>
        {ready ? (
          <Button size="sm" variant="outline" onClick={downloadAll} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Baixar as {ready}
          </Button>
        ) : null}
        <Button size="sm" onClick={convertAll} disabled={!items.length || running}>
          {running ? "Convertendo…" : "Converter para JPG"}
        </Button>
      </div>
    </section>
  );
}