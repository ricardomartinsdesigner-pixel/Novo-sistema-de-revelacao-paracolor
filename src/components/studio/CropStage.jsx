import CropRulers from "@/components/studio/CropRulers";
import PolaroidPreview from "@/components/studio/PolaroidPreview";

// Palco da prévia: desenha o papel no tamanho exato do formato (mesma proporção,
// mesma borda e mesmo recorte do arquivo de impressão) e recebe os gestos.
export default function CropStage({
  photo,
  box,
  inset,
  innerW,
  innerH,
  imageStyle,
  showGrid = false,
  showOriginal = false,
  dragging = false,
  stageRef,
  frameRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  mode,
  model,
  captionAreaEnabled,
  onCaptionChange,
}) {
  if (mode === "polaroid") {
    return (
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-secondary/90 via-secondary/70 to-border/50 ring-1 ring-inset ring-border/60">
        <div ref={stageRef} className="relative" style={{ height: "clamp(340px, 66vh, 620px)" }}>
          <div
            className="absolute left-1/2 top-1/2"
            style={{ width: box.w, height: box.h, marginLeft: -box.w / 2, marginTop: -box.h / 2 }}
          >
            <PolaroidPreview
              photo={photo}
              model={model}
              width={box.w}
              editable={captionAreaEnabled}
              onCaptionChange={onCaptionChange}
              cropInteraction={{ frameRef, dragging, showGrid, showOriginal, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }}
            />
          </div>
          <CropRulers box={box} wCm={photo.wCm} hCm={photo.hCm} />
        </div>
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card/95 px-3 py-1 text-[11px] tracking-wide text-foreground/75 shadow-sm">
          {photo.sizeLabel || "Polaroid"}{photo.wCm && photo.hCm ? ` · ${photo.wCm} × ${photo.hCm} cm` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-secondary/90 via-secondary/70 to-border/50 ring-1 ring-inset ring-border/60">
      <div ref={stageRef} className="relative" style={{ height: "clamp(340px, 66vh, 620px)" }}>
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onPointerUp}
          className="paper absolute left-1/2 top-1/2 touch-none select-none rounded-[2px] bg-white ring-1 ring-black/10"
          style={{
            width: box.w,
            height: box.h,
            marginLeft: -box.w / 2,
            marginTop: -box.h / 2,
            cursor: dragging ? "grabbing" : "grab",
          }}
        >
          {/* marcas de corte nos cantos: mostram a borda exata da impressão */}
          {[
            { top: -9, left: -9, borderTopWidth: 1, borderLeftWidth: 1 },
            { top: -9, right: -9, borderTopWidth: 1, borderRightWidth: 1 },
            { bottom: -9, left: -9, borderBottomWidth: 1, borderLeftWidth: 1 },
            { bottom: -9, right: -9, borderBottomWidth: 1, borderRightWidth: 1 },
          ].map((corners) => (
            <span
              key={Object.keys(corners).join()}
              className="pointer-events-none absolute h-2.5 w-2.5 border-gold-deep/60"
              style={corners}
            />
          ))}
          <div
            className="absolute overflow-hidden bg-white"
            style={{ left: inset, top: inset, width: innerW, height: innerH }}
          >
            <img src={photo.preview} alt="" style={imageStyle} draggable={false} />
            {showOriginal && (
              <img
                src={photo.preview}
                alt=""
                className="absolute inset-0 h-full w-full bg-white object-contain"
                draggable={false}
              />
            )}
            {showGrid && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/3 top-0 h-full w-px bg-white/70" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-white/70" />
                <div className="absolute left-0 top-1/3 h-px w-full bg-white/70" />
                <div className="absolute left-0 top-2/3 h-px w-full bg-white/70" />
              </div>
            )}
          </div>
        </div>

        <CropRulers box={box} wCm={photo.wCm} hCm={photo.hCm} />
      </div>
      <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card/95 px-3 py-1 text-[11px] tracking-wide text-foreground/75 shadow-sm">
        {photo.sizeLabel || "Formato"}
        {photo.wCm && photo.hCm ? ` · ${photo.wCm} × ${photo.hCm} cm` : ""}
      </span>
    </div>
  );
}
