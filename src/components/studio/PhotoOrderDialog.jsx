import { photoColorFilter } from "@/lib/photo-color-effects";
import { useState } from "react";
import { verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import SortablePhotos from "@/components/studio/SortablePhotos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { movePhoto } from "@/lib/photo-order";

const PAGE_SIZE = 60;

export default function PhotoOrderDialog({ photos, onClose, onSave }) {
  const [items, setItems] = useState(photos);
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState(null);
  const [position, setPosition] = useState("");
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const first = page * PAGE_SIZE;
  const visible = items.slice(first, first + PAGE_SIZE);
  const destination = Number(position) - 1;
  const validPosition = Number.isInteger(destination) && destination >= 0 && destination < items.length;

  function applyPosition(event) {
    event.preventDefault();
    if (!target || !validPosition) return;
    setItems((current) => movePhoto(current, target.id, destination));
    setPage(Math.floor(destination / PAGE_SIZE));
    setTarget(null);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Ordenar as fotos</DialogTitle>
          <DialogDescription>Arraste pela alça ou use o número da posição para mover uma foto em todo o lote.</DialogDescription>
        </DialogHeader>

        {target && (
          <form onSubmit={applyPosition} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-2">
            <label className="min-w-0 flex-1 text-xs">
              <span className="block truncate">{target.name}</span>
              <input autoFocus aria-label="Nova posição da foto" type="number" inputMode="numeric" min="1" max={items.length}
                value={position} onChange={(event) => setPosition(event.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
            </label>
            <Button size="sm" type="submit" disabled={!validPosition}>Mover</Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setTarget(null)}>Cancelar movimento</Button>
          </form>
        )}

        <div className="min-h-0 overflow-y-auto">
          <SortablePhotos
            photos={visible} as="ul" itemAs="li" strategy={verticalListSortingStrategy} className="space-y-1 p-1"
            onMove={(id, over) => setItems((current) => movePhoto(current, id, current.findIndex((photo) => photo.id === over)))}
          >
            {(photo, index, handle) => (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1.5">
                <button type="button" {...handle} aria-label={"Arrastar " + photo.name}
                  className="flex h-9 w-9 flex-none touch-none items-center justify-center rounded cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-4 w-4" />
                </button>
                <span className="w-8 flex-none text-center text-xs">{first + index + 1}</span>
                {photo.preview && photo.kind !== "pdf" && <img src={photo.preview} alt="" draggable={false} loading="lazy" className="h-9 w-9 rounded object-cover" style={{ filter: photoColorFilter(photo.colorEffect) }} />}
                <span className="min-w-0 flex-1 truncate text-xs">{photo.name}</span>
                <Button size="sm" variant="ghost" aria-label={"Mover para a posição: " + photo.name}
                  onClick={() => { setTarget(photo); setPosition(String(first + index + 1)); }}>Mover</Button>
              </div>
            )}
          </SortablePhotos>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span>Página {page + 1} de {pageCount} · {items.length} fotos</span>
            <Button size="sm" variant="outline" disabled={page === pageCount - 1} onClick={() => setPage(page + 1)}>Próxima</Button>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(items.map((photo) => photo.id))}>Salvar ordem</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
