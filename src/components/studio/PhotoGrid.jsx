import { rectSortingStrategy } from "@dnd-kit/sortable";
import SortablePhotos from "@/components/studio/SortablePhotos";

const GRID_CLASS = {
  comfortable: "grid items-start grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5",
  compact: "grid items-start grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6",
};

export default function PhotoGrid({ photos, density = "comfortable", canDrag, onReorder, renderCard }) {
  const className = GRID_CLASS[density] || GRID_CLASS.comfortable;
  if (!canDrag) return <div className={className}>{photos.map((photo) => <div key={photo.id}>{renderCard(photo, null)}</div>)}</div>;
  return (
    <SortablePhotos photos={photos} strategy={rectSortingStrategy} onMove={onReorder} className={className}>
      {renderCard}
    </SortablePhotos>
  );
}
