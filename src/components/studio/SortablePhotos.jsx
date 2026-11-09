import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortablePhoto({ photo, as: Item, children }) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  return (
    <Item
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "relative z-30" : undefined}
    >
      {children({ ...attributes, ...listeners, ref: setActivatorNodeRef }, isDragging)}
    </Item>
  );
}

export default function SortablePhotos({ photos, strategy, onMove, className, as: Container = "div", itemAs = "div", children }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => { if (over && active.id !== over.id) onMove(active.id, over.id); }}
    >
      <SortableContext items={photos.map((photo) => photo.id)} strategy={strategy}>
        <Container className={className}>
          {photos.map((photo, index) => (
            <SortablePhoto key={photo.id} photo={photo} as={itemAs}>
              {(handle, dragging) => children(photo, index, handle, dragging)}
            </SortablePhoto>
          ))}
        </Container>
      </SortableContext>
    </DndContext>
  );
}
