import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Info, Loader2, Pencil, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import QualityLegend from "@/components/studio/QualityLegend";
import TierProgress from "@/components/studio/TierProgress";
import { photoColorFilter } from "@/lib/photo-color-effects";
import { ALERT_LABELS } from "@/lib/photo";

// Fechamento do envio: o que está pronto, o que merece revisão, o desconto por
// quantidade e o prazo — tudo antes de ir para o carrinho.
export default function PhotoReview({
  readyCount,
  printCount,
  problemPhotos = [],
  needsConfirmation,
  confirmed,
  onConfirmedChange,
  onEdit,
  onUseWhole,
  total,
  busy,
  onAdd,
  tierArea,
  tierLines = [],
  tierGroups = [],
  tierTiers = [],
  productionLabel,
  readyLabel,
}) {
  const [visibleCount, setVisibleCount] = useState(5);
  const photoIds = problemPhotos.map((photo) => photo.id).join("|");
  useEffect(() => setVisibleCount(5), [photoIds]);
  const visibleProblems = problemPhotos.slice(0, visibleCount);

  return (
    <section className="mt-10 rounded-[1.25rem] border border-border bg-card p-5 sm:p-6">
      <h2 className="text-2xl">Revisão antes de finalizar</h2>
      {readyCount > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400 bg-amber-50 p-4 text-amber-950 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100 sm:p-5">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-base font-semibold">Confira o enquadramento antes de continuar</p>
            <p className="mt-1 text-sm leading-relaxed sm:text-base">
              <strong>As miniaturas acima são uma prévia fiel de como as fotos serão reveladas.</strong>{" "}
              Confira cada imagem pelas miniaturas, ou toque no lápis para editar o enquadramento.
            </p>
          </div>
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl bg-secondary/60 p-3 sm:p-4">
          <p className="font-display text-2xl">{readyCount}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">fotos prontas</p>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3 sm:p-4">
          <p className="font-display text-2xl">{problemPhotos.length}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">para revisar</p>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3 sm:p-4">
          <p className="font-display text-2xl">{printCount}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">impressões no total</p>
        </div>
      </div>

      <QualityLegend />

      <TierProgress area={tierArea} lines={tierLines} groups={tierGroups} tiers={tierTiers} />

      {problemPhotos.length > 0 && (
        <div className="mt-5 space-y-3">
          {visibleProblems.map((photo) => (
            <div key={photo.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <img src={photo.preview} alt="" className="h-12 w-12 rounded-lg object-cover" style={{ filter: photoColorFilter(photo.colorEffect) }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{photo.name}</p>
                <p className="text-[11px] text-amber-800">
                  {(photo.alerts || []).map((alert) => ALERT_LABELS[alert] || alert).join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" disabled={photo.status !== "ready"} onClick={() => onEdit(photo.id)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Ajustar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onUseWhole(photo.id)}>
                  Usar foto inteira
                </Button>
              </div>
            </div>
          ))}
          {problemPhotos.length > 5 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {visibleCount < problemPhotos.length && (
                <Button variant="outline" size="sm" onClick={() => setVisibleCount((count) => Math.min(count + 5, problemPhotos.length))}>
                  Ver mais ({problemPhotos.length - visibleCount} restantes)
                </Button>
              )}
              {visibleCount > 5 && (
                <Button variant="ghost" size="sm" onClick={() => setVisibleCount(5)}>
                  Ver menos
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {needsConfirmation && (
        <label className="mt-5 flex items-start gap-3 rounded-xl bg-secondary/60 p-4 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => onConfirmedChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            Revisei os avisos e quero manter este enquadramento. A Paracolor vai imprimir exatamente como está na prévia.
          </span>
        </label>
      )}

      {readyLabel ? (
        <p className="mt-4 flex items-start gap-2 text-xs leading-snug text-muted-foreground">
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 flex-none text-gold-deep" />
          <span>
            Produção em até <strong className="font-medium text-foreground">{productionLabel}</strong> após a
            liberação do pedido — previsão de ficar pronto:{" "}
            <strong className="font-medium text-foreground">{readyLabel}</strong>.
          </span>
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          Total de {printCount} impressão(ões)
        </p>
        <div className="flex max-w-full flex-wrap items-center gap-3 sm:gap-4">
          <span className="font-display text-2xl">
            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
          <Button size="lg" onClick={onAdd} disabled={busy} className="gap-2 rounded-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
            Adicionar ao carrinho
          </Button>
        </div>
      </div>
      {!busy && readyCount > 0 && (
        <p className="mt-2 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Arquivos de impressão em 300 DPI, fiéis à prévia
        </p>
      )}
    </section>
  );
}
