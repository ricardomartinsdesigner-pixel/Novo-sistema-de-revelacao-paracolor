import { FileText } from "lucide-react";
import PolaroidPreview from "@/components/studio/PolaroidPreview";
import { photoColorFilter } from "@/lib/photo-color-effects";
import { computeLayout, printAspect } from "@/lib/photo";

// Miniatura fiel ao arquivo de impressão: mostra o formato, a borda branca,
// o zoom e o deslocamento atuais — e se atualiza na hora em que o formato muda.
export default function PhotoThumb({ photo, model }) {
  // PDF é impresso como enviado: não tem prévia nem ajuste de enquadramento.
  if (photo.kind === "pdf") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-sm bg-white px-2 text-center">
        <FileText className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-[10px] leading-tight text-muted-foreground">PDF impresso como está</span>
      </div>
    );
  }

  if (photo.area === "polaroid") {
    return (
      <div className="mx-auto w-[86%]">
        <PolaroidPreview photo={photo} model={model} />
      </div>
    );
  }

  const aspect = photo.aspect || (photo.wCm && photo.hCm ? photo.wCm / photo.hCm : 1);
  const layout = computeLayout({
    imgW: photo.w || 1,
    imgH: photo.h || 1,
    aspect: printAspect(photo),
    zoom: photo.zoom || 1,
    rotation: photo.rotation || 0,
    fit: photo.fit || "cover",
  });
  const widthPct = (layout.drawW / layout.frameW) * 100;
  const heightPct = (layout.drawH / layout.frameH) * 100;
  // Borda branca de 4,5% do lado menor, igual ao arquivo de impressão.
  const frameHeight = 1 / aspect;
  const pad = photo.border ? 0.045 * Math.min(1, frameHeight) : 0;

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="relative overflow-hidden rounded-sm bg-white"
        style={{
          aspectRatio: String(aspect),
          width: aspect >= 1 ? "100%" : "auto",
          height: aspect >= 1 ? "auto" : "100%",
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        <div
          className="absolute overflow-hidden bg-white"
          style={{
            left: `${pad * 100}%`,
            right: `${pad * 100}%`,
            top: `${(pad / frameHeight) * 100}%`,
            bottom: `${(pad / frameHeight) * 100}%`,
          }}
        >
          <div
            className="absolute inset-0"
            style={{ transform: `translate(${(photo.ox || 0) * 100}%, ${(photo.oy || 0) * 100}%)` }}
          >
            <img
              src={photo.preview}
              alt=""
              draggable={false}
              className="absolute left-1/2 top-1/2 select-none"
              style={{
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                maxWidth: "none",
                objectFit: photo.fit === "contain" ? "contain" : "cover",
                objectPosition: "center",
                filter: photoColorFilter(photo.colorEffect),
                transform: `translate(-50%, -50%) rotate(${photo.rotation || 0}deg) scale(${
                  photo.flipH ? -1 : 1
                }, ${photo.flipV ? -1 : 1})`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}