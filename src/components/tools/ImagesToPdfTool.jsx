import { useState } from "react";
import { FileText, Images } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import OrganizerList from "@/components/tools/OrganizerList";
import { loadImage } from "@/lib/photo";
import { convertHeicToJpeg, isHeicFile } from "@/lib/heic";

const PAGE_SIZES = [
  { value: "a4", label: "A4 retrato" },
  { value: "landscape", label: "A4 paisagem" },
  { value: "auto", label: "Tamanho da foto" },
];

const pxToMm = (px) => (px * 25.4) / 96;

export default function ImagesToPdfTool() {
  const [items, setItems] = useState([]);
  const [pageSize, setPageSize] = useState("a4");
  const [building, setBuilding] = useState(false);

  async function addImages(files) {
    const loaded = [];
    for (const file of Array.from(files || [])) {
      try {
        const source = isHeicFile(file) ? await convertHeicToJpeg(file) : file;
        loaded.push({
          key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name.replace(/\.[^.]+$/, ".jpg"),
          url: URL.createObjectURL(source),
        });
      } catch {
        toast.error(`Não foi possível abrir ${file.name}.`);
      }
    }
    setItems((current) => [...current, ...loaded]);
  }

  function move(index, direction) {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index) {
    setItems((current) => {
      URL.revokeObjectURL(current[index]?.url);
      return current.filter((_, position) => position !== index);
    });
  }

  function clearAll() {
    items.forEach((item) => URL.revokeObjectURL(item.url));
    setItems([]);
  }

  async function build() {
    if (!items.length) return;
    setBuilding(true);
    try {
      const { jsPDF } = await import("jspdf");
      let pdf = null;

      for (const item of items) {
        const image = await loadImage(item.url);
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d").drawImage(image, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const portrait = canvas.height >= canvas.width;

        if (pageSize === "auto") {
          const format = [pxToMm(canvas.width), pxToMm(canvas.height)];
          const orientation = portrait ? "portrait" : "landscape";
          if (!pdf) pdf = new jsPDF({ unit: "mm", format, orientation });
          else pdf.addPage(format, orientation);
        } else if (!pdf) {
          pdf = new jsPDF({ unit: "mm", format: "a4", orientation: pageSize === "landscape" ? "landscape" : "portrait" });
        } else {
          pdf.addPage("a4", pageSize === "landscape" ? "landscape" : "portrait");
        }

        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = pageSize === "auto" ? 0 : 10;
        const scale = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
        const width = canvas.width * scale;
        const height = canvas.height * scale;
        pdf.addImage(dataUrl, "JPEG", (pageW - width) / 2, (pageH - height) / 2, width, height);
      }

      pdf.save("paracolor-fotos.pdf");
      toast.success(`PDF gerado com ${items.length} página(s).`);
    } catch {
      toast.error("Não foi possível montar o PDF. Tente novamente.");
    } finally {
      setBuilding(false);
    }
  }

  const list = items.map((item) => ({ key: item.key, label: item.name, thumb: item.url }));

  return (
    <section className="card-glass p-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Images className="h-4 w-4" /> Fotos em PDF
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Cada foto vira uma página. Arraste a ordem pelos botões e monte o PDF do jeito que precisa.
      </p>

      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gold/60 px-3 py-6 text-xs text-muted-foreground hover:border-gold hover:bg-gold-soft/25">
        <Images className="h-4 w-4" /> Adicionar fotos
        <input
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(event) => {
            addImages(event.target.files);
            event.target.value = "";
          }}
        />
      </label>

      <OrganizerList items={list} onMove={move} onRemove={remove} emptyLabel="Nenhuma foto ainda — adicione as fotos que vão virar páginas." />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <select
          value={pageSize}
          onChange={(event) => setPageSize(event.target.value)}
          className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size.value} value={size.value}>{size.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={clearAll} disabled={!items.length || building}>Limpar</Button>
          <Button size="sm" onClick={build} disabled={!items.length || building}>
            {building ? (
              <><FileText className="h-3.5 w-3.5" /> Gerando…</>
            ) : "Gerar PDF"}
          </Button>
        </div>
      </div>
    </section>
  );
}