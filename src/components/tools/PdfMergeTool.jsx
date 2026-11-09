import { useRef, useState } from "react";
import { FileText, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import OrganizerList from "@/components/tools/OrganizerList";

export default function PdfMergeTool() {
  const documents = useRef(new Map());
  const [pages, setPages] = useState([]);
  const [names, setNames] = useState({});
  const [busy, setBusy] = useState(false);
  const [merging, setMerging] = useState(false);

  async function addFiles(selected) {
    const files = Array.from(selected || []);
    if (!files.length) return;
    setBusy(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      for (const file of files) {
        try {
          const document = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
          const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          documents.current.set(id, document);
          setNames((current) => ({ ...current, [id]: file.name.replace(/\.pdf$/i, "") }));
          const count = document.getPageCount();
          setPages((current) => [
            ...current,
            ...Array.from({ length: count }, (_, index) => ({ key: `${id}-${index}`, id, index })),
          ]);
        } catch {
          toast.error(`Não foi possível abrir ${file.name} — verifique se o PDF não está protegido.`);
        }
      }
    } catch {
      toast.error("Não foi possível carregar a ferramenta de PDF. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function move(index, direction) {
    setPages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index) {
    setPages((current) => current.filter((_, position) => position !== index));
  }

  function clearAll() {
    setPages([]);
    setNames({});
    documents.current.clear();
  }

  async function merge() {
    if (!pages.length) return;
    setMerging(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const merged = await PDFDocument.create();
      for (const page of pages) {
        const source = documents.current.get(page.id);
        if (!source) continue;
        const [copied] = await merged.copyPages(source, [page.index]);
        merged.addPage(copied);
      }
      const bytes = await merged.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "paracolor-documento-unido.pdf";
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`PDF gerado com ${pages.length} página(s).`);
    } catch {
      toast.error("Não foi possível juntar os PDFs. Tente novamente.");
    } finally {
      setMerging(false);
    }
  }

  const items = pages.map((page) => ({
    key: page.key,
    label: names[page.id] || "Documento",
    sub: `Página ${page.index + 1}`,
  }));

  return (
    <section className="card-glass p-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Layers className="h-4 w-4" /> Juntar PDFs
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Envie vários PDFs e organize a ordem das páginas antes de gerar o arquivo final.
      </p>

      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gold/60 px-3 py-6 text-xs text-muted-foreground hover:border-gold hover:bg-gold-soft/25">
        <FileText className="h-4 w-4" />
        {busy ? "Abrindo arquivos…" : "Adicionar PDFs"}
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          disabled={busy || merging}
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>

      <OrganizerList items={items} onMove={move} onRemove={remove} emptyLabel="Nenhuma página ainda — adicione pelo menos um PDF." />

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{pages.length} página(s)</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={clearAll} disabled={!pages.length || busy || merging}>Limpar</Button>
          <Button size="sm" onClick={merge} disabled={!pages.length || busy || merging}>
            {merging ? "Gerando…" : "Juntar e baixar"}
          </Button>
        </div>
      </div>
    </section>
  );
}