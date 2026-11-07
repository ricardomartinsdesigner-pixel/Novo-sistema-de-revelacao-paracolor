import { Copy, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import PhotoThumb from "@/components/studio/PhotoThumb";
import { ALERT_LABELS } from "@/lib/photo";

// Resultado final ampliado: o corte, a borda e a legenda exatamente como sairão
// impressos, sem abrir o editor.
export default function PhotoPreviewDialog({ photo, model, onClose, onEdit, onDelete, onDuplicate }) {
  if (!photo) return null;
  const aspect = photo.aspect || (photo.wCm && photo.hCm ? photo.wCm / photo.hCm : 1);
  const alerts = photo.alerts || [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] w-[94vw] max-w-xl overflow-y-auto">
        <DialogTitle className="truncate font-display text-lg">{photo.name}</DialogTitle>
        <p className="text-xs text-muted-foreground">
          {photo.sizeLabel || "Formato"} · {photo.qualityLabel || "—"}
          {photo.dpi ? ` · ${photo.dpi} dpi` : ""}
          {photo.copies > 1 ? ` · ${photo.copies} cópia(s)` : ""}
        </p>

        <div className="mt-3 flex items-center justify-center rounded-xl bg-secondary p-4 checkerboard">
          <div
            className="w-full"
            style={{
              aspectRatio: String(aspect),
              maxWidth: `min(100%, ${Math.max(26, Math.round(56 * aspect))}vh)`,
            }}
          >
            <PhotoThumb photo={photo} model={model} />
          </div>
        </div>

        {alerts.length ? (
          <ul className="mt-3 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
            {alerts.map((alert) => (
              <li key={alert}>· {ALERT_LABELS[alert] || alert}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Tudo certo: sem avisos de corte ou resolução para este formato.
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {photo.kind !== "pdf" ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onEdit(photo.id)}>
              <Pencil className="h-3.5 w-3.5" /> Ajustar
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onDuplicate(photo.id)}>
            <Copy className="h-3.5 w-3.5" /> Duplicar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-red-600" onClick={() => onDelete(photo.id)}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}