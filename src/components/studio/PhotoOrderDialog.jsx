import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// A produção imprime na ordem da lista: esta janela permite arrastar as fotos
// para a posição desejada, o que vale também para a ordem dos arquivos no ZIP.
export default function PhotoOrderDialog({ photos, onClose, onSave }) {
  const [items, setItems] = useState(
    photos.map((photo) => ({ id: photo.id, name: photo.name, preview: photo.preview }))
  );

  function handleDragEnd(result) {
    if (!result.destination) return;
    const next = Array.from(items);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setItems(next);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ordenar as fotos</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Arraste pelo ícone à esquerda. A impressão e os arquivos de produção seguem esta ordem.
        </p>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="studio-photos">
            {(droppable) => (
              <ul ref={droppable.innerRef} {...droppable.droppableProps} className="mt-3 space-y-2">
                {items.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(draggable, snapshot) => (
                      <li
                        ref={draggable.innerRef}
                        {...draggable.draggableProps}
                        className={`flex items-center gap-3 rounded-xl border bg-card p-2 ${
                          snapshot.isDragging ? "border-primary shadow-lg" : "border-border"
                        }`}
                      >
                        <span
                          {...draggable.dragHandleProps}
                          aria-label={`Mover ${item.name}`}
                          className="cursor-grab p-1 text-muted-foreground active:cursor-grabbing"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <span className="w-6 text-center text-xs text-muted-foreground">{index + 1}</span>
                        {item.preview ? (
                          <img src={item.preview} alt="" className="h-10 w-10 rounded-md object-cover" />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-xs">{item.name}</span>
                      </li>
                    )}
                  </Draggable>
                ))}
                {droppable.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(items.map((item) => item.id))}>Salvar ordem</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}