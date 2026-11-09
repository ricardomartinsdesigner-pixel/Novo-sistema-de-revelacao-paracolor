import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import PolaroidPreview from "@/components/studio/PolaroidPreview";

// Nested Radix dialog keeps the fullscreen editor inside the parent dialog's
// focus and pointer handling, so tapping the caption field does not close it.
export default function CaptionFullscreen({ photo, model, onCaption, onClose }) {
  const inputRef = useRef(null);
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  const caption = photo.caption || "";
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="!fixed !inset-0 !left-0 !top-0 !z-[80] !m-0 !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !gap-0 !rounded-none !border-0 !p-0 !shadow-none !flex flex-col overflow-hidden bg-background sm:!rounded-none [&>button:last-child]:hidden"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <DialogTitle className="font-display text-lg">Escreva na polaroid</DialogTitle>
          <button type="button" onClick={onClose} aria-label="Fechar escrita" className="rounded-full p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-3">
          <div className="w-full max-w-[280px]">
            <PolaroidPreview photo={photo} model={model} />
          </div>
        </div>

        <div className="space-y-3 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <textarea
            ref={inputRef}
            value={caption}
            onChange={(event) => onCaption(event.target.value)}
            maxLength={220}
            rows={3}
            placeholder="Escreva aqui a sua legenda"
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{caption.length}/220</span>
            <Button onClick={onClose} className="min-w-[120px]">Pronto</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
