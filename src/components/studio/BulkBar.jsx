import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

// Controles de lote em painel: aplicam na hora, nas fotos selecionadas ou em todas.
export default function BulkBar({
  sizes,
  selectedCount,
  totalCount,
  sizeId,
  onSizeChange,
  fit,
  onFitChange,
  border,
  onBorderChange,
  showBorder = true,
  copies,
  onCopiesChange,
  onDeleteSelected,
  onDuplicateSelected,
  onSelectAll,
  onInvert,
  onClearSelection,
}) {
  const targetCount = selectedCount > 0 ? selectedCount : totalCount;

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl bg-secondary/60 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
        Aplicando em <strong className="text-foreground">{targetCount} foto(s)</strong>
        {selectedCount > 0 ? " selecionadas" : " — selecione fotos para aplicar só nelas"}.
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onSelectAll}
          className="rounded-full border border-gold/55 bg-gold-soft/40 px-3 py-1 text-[11px] font-medium text-foreground transition hover:border-gold"
        >
          Selecionar todas
        </button>
        <button
          type="button"
          onClick={onInvert}
          className="rounded-full border border-gold/55 bg-gold-soft/40 px-3 py-1 text-[11px] font-medium text-foreground transition hover:border-gold"
        >
          Inverter
        </button>
        {selectedCount > 0 ? (
          <button
            type="button"
            onClick={onClearSelection}
            className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            Limpar seleção ({selectedCount})
          </button>
        ) : null}
      </div>

      <label className="block">
        <span className="eyebrow">Formato</span>
        <select
          value={sizeId}
          onChange={(event) => onSizeChange(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          {sizes.map((size) => (
            <option key={size.id} value={size.id}>
              {size.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="eyebrow">Enquadramento</span>
        <select
          value={fit}
          onChange={(event) => onFitChange(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="cover">Preenchida (pode cortar)</option>
          <option value="contain">Foto inteira (com borda)</option>
        </select>
      </label>

      {showBorder ? (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
          <span className="text-sm">Borda branca</span>
          <Switch checked={border} onCheckedChange={onBorderChange} aria-label="Borda branca em todas as fotos" />
        </label>
      ) : null}

      <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
        <span className="text-sm">Cópias por foto</span>
        <input
          type="number"
          min="1"
          max="50"
          value={copies}
          onChange={(event) => onCopiesChange(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
          aria-label="Cópias por foto"
          className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
        />
      </label>

      {selectedCount > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onDuplicateSelected} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Duplicar selecionadas
          </Button>
          <Button size="sm" variant="outline" onClick={onDeleteSelected} className="gap-1.5 text-red-600">
            <Trash2 className="h-3.5 w-3.5" /> Excluir selecionadas
          </Button>
        </div>
      ) : null}
    </div>
  );
}