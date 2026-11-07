import { AlertTriangle, Check, Copy, ImageOff, Pencil, Trash2 } from "lucide-react";
import PhotoThumb from "@/components/studio/PhotoThumb";

const QUALITY_DOT = {
  excelente: "bg-emerald-600",
  adequada: "bg-emerald-500",
  baixa: "bg-amber-500",
  insuficiente: "bg-red-600",
};

const QUALITY_LABEL = {
  excelente: "Excelente",
  adequada: "Adequada",
  baixa: "Baixa",
  insuficiente: "Insuficiente",
};

export default function PhotoCard({
  photo,
  model,
  sizes = [],
  index = null,
  compact = false,
  isDragging = false,
  dragHandleProps,
  selected,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
  onSizeChange,
  onPreview,
}) {
  const hasAlert = (photo.alerts || []).some((alert) => alert !== "resolucao_baixa");
  // A caixa da miniatura tem a proporção real do papel escolhido: 10x15 em pé,
  // 15x10 deitado, 15x21 mais alto — e a polaroide segue o papel dela (9x11).
  // Trocar o formato no seletor redesenha o cartão na hora.
  const isPolaroid = photo.area === "polaroid";
  const paperAspect = Number(photo.aspect) > 0 ? Number(photo.aspect) : 1;
  const boxAspect = isPolaroid ? (model?.width_cm || 9) / (model?.height_cm || 11) : paperAspect;

  return (
    <div
      className={`group relative h-full overflow-hidden rounded-xl border bg-card transition ${
        selected ? "border-gold ring-2 ring-gold/30 elev-2" : "border-border elev-1"
      } ${isDragging ? "elev-3 ring-2 ring-gold/60" : ""}`}
    >
      <button
        type="button"
        onClick={() => onToggle(photo.id)}
        aria-label={`${selected ? "Desmarcar" : "Selecionar"} ${photo.name}`}
        aria-pressed={Boolean(selected)}
        className={`absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm transition ${
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-white bg-white/95 text-foreground/35 hover:text-foreground"
        }`}
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </button>

      {hasAlert && (
        <span
          className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow-sm"
          title="Enquadramento com alerta"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      )}

      <div
        {...(dragHandleProps || {})}
        onClick={() => onPreview?.(photo.id)}
        className={`relative overflow-hidden bg-secondary ${
          dragHandleProps ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        style={{ aspectRatio: String(boxAspect) }}
      >
        {photo.status === "error" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2 text-center text-xs font-medium text-red-700">
            <ImageOff className="h-6 w-6 flex-none" />
            <span className="leading-snug">{photo.error || "Arquivo não suportado"}</span>
          </div>
        ) : (
          <PhotoThumb photo={photo} model={model} />
        )}

        {index !== null ? (
          <span className="pointer-events-none absolute bottom-1 left-2 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
            {index + 1}
          </span>
        ) : null}

        {photo.status === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/85 text-xs font-medium text-foreground">
            Enviando…
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          {sizes.length > 1 && onSizeChange ? (
            <select
              value={photo.sizeId || ""}
              onChange={(event) => onSizeChange(photo.id, event.target.value)}
              aria-label={`Formato de ${photo.name}`}
              className="block w-full min-w-0 truncate rounded-md border border-input bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground"
            >
              {sizes.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="truncate text-xs font-medium">{photo.sizeLabel || "Escolha o tamanho"}</p>
          )}
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            <span className={`h-1.5 w-1.5 flex-none rounded-full ${QUALITY_DOT[photo.quality] || "bg-muted-foreground"}`} />
            <span className="truncate">
              {photo.kind === "pdf" ? "PDF" : QUALITY_LABEL[photo.quality] || photo.qualityLabel || "—"}
              {photo.dpi ? ` · ${photo.dpi} dpi` : ""}
              {photo.copies > 1 ? ` · ${photo.copies}x` : ""}
            </span>
          </p>
        </div>
        {compact ? null : (
          <div className="flex flex-none items-center gap-0.5 rounded-md border border-gold/30 bg-background/85 p-0.5 shadow-sm">
            {photo.kind !== "pdf" ? (
              <button type="button" onClick={() => onEdit(photo.id)} aria-label="Editar enquadramento" className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button type="button" onClick={() => onDuplicate(photo.id)} aria-label="Duplicar foto" className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => onDelete(photo.id)} aria-label="Excluir foto" className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}