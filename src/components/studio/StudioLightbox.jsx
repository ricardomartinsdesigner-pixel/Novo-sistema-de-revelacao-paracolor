import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Image } from "@/components/ui/image";

/** Visualização ampliada acessível: teclado, botões grandes e textos alternativos. */
export default function StudioLightbox({ photos, index, onChange, onClose }) {
  const open = typeof index === "number" && index >= 0 && Boolean(photos[index]);
  const photo = open ? photos[index] : null;

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (event.key === "ArrowRight") onChange((index + 1) % photos.length);
      if (event.key === "ArrowLeft") onChange((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, index, photos.length, onChange]);

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none [&>button]:hidden">
        <DialogTitle className="sr-only">Foto ampliada — {photo.alt || "galeria do estúdio"}</DialogTitle>
        <div className="relative">
          <Image
            src={photo.image_url}
            alt={photo.alt || ""}
            className="max-h-[78vh] w-full rounded-2xl bg-black/5 object-contain"
            fittingType="fit"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar foto ampliada"
            className="absolute right-2 top-2 rounded-full bg-background/90 p-2 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
          {photos.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => onChange((index - 1 + photos.length) % photos.length)}
                aria-label="Foto anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2.5 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange((index + 1) % photos.length)}
                aria-label="Próxima foto"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2.5 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}
          <p className="mt-2 text-center text-xs text-background/90">
            {index + 1} de {photos.length}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}