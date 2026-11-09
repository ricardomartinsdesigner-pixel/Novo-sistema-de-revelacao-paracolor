import { useState } from "react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 24;

export default function OrderPhotoGallery({ photos, Photo, className }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  if (!photos.length) return null;

  return (
    <>
      <div className={className}>
        {photos.slice(0, limit).map((photo) => <Photo key={photo.id} photo={photo} />)}
      </div>
      {photos.length > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span aria-live="polite">{Math.min(limit, photos.length)} de {photos.length} fotos</span>
          {limit < photos.length && <Button type="button" size="sm" variant="outline" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
            Ver mais fotos
          </Button>}
        </div>
      )}
    </>
  );
}
