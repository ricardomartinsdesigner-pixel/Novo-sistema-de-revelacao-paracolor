import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";

// items-start: cada cartão termina logo abaixo do rodapé, mesmo com papéis de
// proporções diferentes (retrato, paisagem, quadrado) na mesma linha.
const GRID_CLASS = {
  comfortable: "grid items-start grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5",
  compact: "grid items-start grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6",
};

// Grade das fotos. Com o filtro limpo as fotos podem ser arrastadas (mouse ou
// toque longo) para qualquer posição — a ordem vale para a impressão e o ZIP.
export default function PhotoGrid({ photos, density = "comfortable", canDrag, onReorder, renderCard }) {
  const gridClass = GRID_CLASS[density] || GRID_CLASS.comfortable;

  if (!canDrag) {
    return (
      <div className={gridClass}>
        {photos.map((photo, index) => (
          <div key={photo.id}>{renderCard(photo, null)}</div>
        ))}
      </div>
    );
  }

  function handleDragEnd(result) {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    onReorder(result.source.index, result.destination.index);
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="studio-grid" direction="horizontal">
        {(droppable) => (
          <div ref={droppable.innerRef} {...droppable.droppableProps} className={gridClass}>
            {photos.map((photo, index) => (
              <Draggable key={photo.id} draggableId={photo.id} index={index}>
                {(draggable, snapshot) => (
                  <div
                    ref={draggable.innerRef}
                    {...draggable.draggableProps}
                    className={snapshot.isDragging ? "z-20" : undefined}
                  >
                    {renderCard(photo, index, draggable.dragHandleProps, snapshot.isDragging)}
                  </div>
                )}
              </Draggable>
            ))}
            {droppable.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}