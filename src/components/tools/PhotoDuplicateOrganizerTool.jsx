import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Images, LoaderCircle, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import PhotoDuplicateReview from "@/components/tools/PhotoDuplicateReview";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/store";
import { analyzePhotoDuplicates } from "@/lib/photo-duplicates";
import { setPendingPhotoImport } from "@/lib/pending-photo-import";
import { MAX_ORDER_PHOTOS } from "@/lib/photo-order";
import { PHOTO_ACCEPT, prepareUploads } from "@/lib/upload-formats";

export default function PhotoDuplicateOrganizerTool({ onNavigate }) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [entries, setEntries] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const enabled = settings?.module_photo_duplicate_organizer !== false;

  async function selectFiles(event) {
    const input = Array.from(event.target.files || []);
    event.target.value = "";
    if (!input.length || busy) return;
    if (input.length > MAX_ORDER_PHOTOS) toast.warning(`Serão analisadas até ${MAX_ORDER_PHOTOS} imagens por vez.`);
    const files = input.slice(0, MAX_ORDER_PHOTOS);
    setBusy(true);
    setEntries([]);
    setError("");
    try {
      const { files: prepared, heicFailed } = await prepareUploads(files);
      if (heicFailed) toast.warning(`${heicFailed} arquivo(s) HEIC não puderam ser abertos. Envie essas imagens em JPG.`);
      if (!prepared.length) {
        setError("Não foi possível abrir as imagens selecionadas.");
        return;
      }
      const analyzed = await analyzePhotoDuplicates(prepared, [], (done, total) => setProgress({ done, total }));
      setEntries(analyzed);
      if (!analyzed.some((entry) => entry.exactGroup || entry.similarMatches.length)) {
        toast.success("Análise concluída: não encontramos fotos repetidas ou parecidas.");
      }
    } catch {
      setError("Não foi possível analisar esse lote. Tente selecionar menos imagens por vez.");
    } finally {
      setBusy(false);
      setProgress({ done: 0, total: 0 });
    }
  }

  async function continueToOrder(selected, destination) {
    if (!enabled) return;
    setPendingPhotoImport(destination, selected);
    onNavigate?.();
    await navigate({ to: destination === "polaroid" ? "/polaroids/criar" : "/revelar" });
  }

  if (!enabled) return null;

  return (
    <section className="card-glass p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium"><ScanSearch className="h-4 w-4" /> Organizador de fotos repetidas</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Separe duplicadas exatas e imagens parecidas antes de montar o pedido. A análise é feita no navegador; as fotos só seguem para o envio quando você escolhe um destino.
      </p>
      {!entries.length && (
        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gold/60 px-3 py-6 text-center text-xs hover:border-gold">
          <Images className="mb-2 h-5 w-5" />
          {busy ? `Analisando imagens ${progress.done}/${progress.total}…` : "Escolher fotos para analisar"}
          <input type="file" accept={PHOTO_ACCEPT} multiple disabled={busy} className="sr-only" onChange={selectFiles} />
        </label>
      )}
      {busy && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Lendo as imagens localmente…</p>}
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
      {entries.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{entries.length} imagem(ns) analisada(s). Revise a seleção antes de continuar.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setEntries([])}>Analisar outro lote</Button>
          </div>
          <PhotoDuplicateReview entries={entries} onContinue={continueToOrder} destinationButtons />
        </div>
      )}
    </section>
  );
}
