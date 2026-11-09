import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Images, ScanSearch, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { keepOnePerExactGroup } from "@/lib/photo-duplicates";

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "exact", label: "Duplicadas exatas" },
  { id: "similar", label: "Parecidas" },
  { id: "unique", label: "Sem repetição" },
];

export default function PhotoDuplicateReview({ entries, onContinue, onCancel, destinationButtons = false }) {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(() => entries.map((entry) => entry.id));
  const [previews, setPreviews] = useState({});
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const counts = useMemo(() => ({
    all: entries.length,
    exact: entries.filter((entry) => entry.exactGroup).length,
    similar: entries.filter((entry) => entry.similarMatches.length > 0).length,
    unique: entries.filter((entry) => !entry.exactGroup && !entry.similarMatches.length).length,
  }), [entries]);
  const visible = entries.filter((entry) => {
    if (filter === "exact") return Boolean(entry.exactGroup);
    if (filter === "similar") return entry.similarMatches.length > 0;
    if (filter === "unique") return !entry.exactGroup && !entry.similarMatches.length;
    return true;
  });

  useEffect(() => {
    const next = {};
    entries.forEach((entry) => {
      if (entry.file?.type?.startsWith("image/")) next[entry.id] = URL.createObjectURL(entry.file);
    });
    setPreviews(next);
    return () => Object.values(next).forEach((url) => URL.revokeObjectURL(url));
  }, [entries]);

  function toggle(id) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function continueTo(destination = null) {
    const chosen = entries.filter((entry) => selectedSet.has(entry.id));
    onContinue(chosen, destination);
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="eyebrow">Revisão das imagens</p>
        <h2 className="mt-1 text-xl font-semibold">Encontramos {counts.exact} arquivo(s) duplicado(s) e {counts.similar} possivelmente parecido(s)</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          A comparação é feita neste navegador. “Parecidas” são apenas sugestões; confira antes de remover. Tirar uma foto da seleção não apaga o arquivo do aparelho.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Button key={item.id} type="button" size="sm" variant={filter === item.id ? "default" : "outline"} onClick={() => setFilter(item.id)}>
            {item.label} <span className="ml-1 opacity-70">{counts[item.id]}</span>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(entries.map((entry) => entry.id))}>
          <Check className="mr-1.5 h-3.5 w-3.5" /> Manter todas
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setSelected(keepOnePerExactGroup(entries, selected))}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Manter uma de cada duplicada
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Limpar seleção
        </Button>
      </div>

      {visible.length ? (
        <div className="grid max-h-[46dvh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {visible.map((entry) => {
            const exactExisting = entry.exactMatches.some((match) => match.existing);
            const duplicateLabel = entry.exactGroup ? "Duplicada exata" : entry.similarMatches.length ? "Possivelmente parecida" : "Sem repetição detectada";
            return (
              <label key={entry.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${selectedSet.has(entry.id) ? "border-primary/60 bg-accent/40" : "border-border bg-card opacity-70"}`}>
                <input type="checkbox" checked={selectedSet.has(entry.id)} onChange={() => toggle(entry.id)} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
                {previews[entry.id] ? (
                  <img src={previews[entry.id]} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-muted object-cover" />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-xs">PDF</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block break-all text-sm font-medium">{entry.file.name}</span>
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${entry.exactGroup ? "bg-destructive/10 text-destructive" : entry.similarMatches.length ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"}`}>
                    {entry.exactGroup ? <Copy className="h-3 w-3" /> : entry.similarMatches.length ? <ScanSearch className="h-3 w-3" /> : <Images className="h-3 w-3" />}
                    {duplicateLabel}
                  </span>
                  {exactExisting && <span className="mt-1 block text-[11px] text-muted-foreground">Uma imagem igual já está no pedido.</span>}
                  {entry.similarMatches.length > 0 && !entry.exactGroup && (
                    <span className="mt-1 block truncate text-[11px] text-muted-foreground">Parecida com: {entry.similarMatches[0].name}</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Não há imagens nesta categoria.</p>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{selected.length} de {entries.length} arquivo(s) selecionado(s)</p>
        <div className="flex flex-wrap gap-2">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Voltar</Button>}
          {destinationButtons ? (
            <>
              <Button type="button" disabled={!selected.length} onClick={() => continueTo("revelacao")}>Ir para Revelação normal</Button>
              <Button type="button" variant="secondary" disabled={!selected.length} onClick={() => continueTo("polaroid")}>Ir para Polaroides</Button>
            </>
          ) : (
            <Button type="button" disabled={!selected.length} onClick={() => continueTo()}>Adicionar selecionadas ao envio</Button>
          )}
        </div>
      </div>
    </section>
  );
}
