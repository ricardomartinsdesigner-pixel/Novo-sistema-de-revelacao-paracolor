import { Image as ImageIcon } from "lucide-react";
import { captionFont } from "@/lib/caption-style";
import { polaroidRatios } from "@/lib/polaroid";

// Prévia do papel com a mesma geometria da impressão: área da foto quadrada e
// faixa branca da legenda nas medidas reais do modelo.
export default function PolaroidModelPreview({ model, maxWidth = 190, caption = "sua legenda" }) {
  const ratios = polaroidRatios(model);
  const width = Number(model?.width_cm) || 9;
  const height = Number(model?.height_cm) || 11;
  const hasCaption = model?.has_caption !== false;

  return (
    <div
      className="relative w-full overflow-hidden rounded-[3px] shadow-[0_16px_34px_-20px_rgba(26,22,20,0.6)] ring-1 ring-black/5"
      style={{
        aspectRatio: `${width} / ${height}`,
        maxWidth,
        backgroundColor: model?.frame_color || "#ffffff",
      }}
    >
      <div
        className="absolute flex items-center justify-center overflow-hidden bg-secondary"
        style={{
          left: `${ratios.left * 100}%`,
          right: `${ratios.left * 100}%`,
          top: `${ratios.top * 100}%`,
          height: `${ratios.photoH * 100}%`,
        }}
      >
        <ImageIcon className="h-[26%] w-[26%] text-muted-foreground/50" strokeWidth={1.2} aria-hidden="true" />
      </div>

      {hasCaption ? (
        <div
          className="absolute inset-x-0 flex items-center justify-center"
          style={{ bottom: 0, height: `${ratios.caption * 100}%` }}
        >
          <span
            className="text-muted-foreground/80"
            style={{ fontFamily: captionFont({ font: "hand" }), fontSize: "0.95rem", lineHeight: 1 }}
          >
            {caption}
          </span>
        </div>
      ) : null}
    </div>
  );
}