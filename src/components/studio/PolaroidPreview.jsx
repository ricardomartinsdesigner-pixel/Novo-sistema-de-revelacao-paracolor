import { useEffect, useRef, useState } from "react";
import { computeLayout } from "@/lib/photo";
import { polaroidRatios } from "@/lib/polaroid";
import { captionElement, captionFont } from "@/lib/caption-style";

export default function PolaroidPreview({ photo, model, width = 260, editable = false, onCaptionChange }) {
  const boxRef = useRef(null);
  const [size, setSize] = useState({ w: width, h: width });

  useEffect(() => {
    if (!boxRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ w: rect.width, h: rect.height });
    });
    observer.observe(boxRef.current);
    return () => observer.disconnect();
  }, []);

  const frameColor = model?.frame_color || "#ffffff";
  // Foto quadrada: a área de impressão e a prévia usam as mesmas frações.
  const ratios = polaroidRatios(model);
  const hasCaption = model?.has_caption !== false;
  const layout = computeLayout({
    imgW: photo.w || 1,
    imgH: photo.h || 1,
    aspect: 1,
    zoom: photo.zoom || 1,
    rotation: photo.rotation || 0,
    fit: photo.fit || "cover",
  });
  const photoBoxW = size.w * ratios.photoW;
  const photoBoxH = size.h * ratios.photoH;
  const scalePx = photoBoxW / layout.frameW;
  const drawW = layout.drawW * scalePx;
  const drawH = layout.drawH * scalePx;
  const style = photo.captionStyle || {};
  const element = captionElement(style);

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden rounded-sm"
      style={{
        aspectRatio: `${model?.width_cm || 9} / ${model?.height_cm || 11}`,
        background: frameColor,
        boxShadow: "0 10px 30px -18px rgba(26,22,20,0.45)",
      }}
    >
      <div
        className="absolute overflow-hidden bg-muted"
        style={{
          left: `${ratios.left * 100}%`,
          right: `${ratios.left * 100}%`,
          top: `${ratios.top * 100}%`,
          height: `${ratios.photoH * 100}%`,
        }}
      >
        {photo.preview ? (
          <img
            src={photo.preview}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 select-none"
            style={{
              width: drawW,
              height: drawH,
              maxWidth: "none",
              transform: `translate(-50%, -50%) translate(${(photo.ox || 0) * photoBoxW}px, ${
                (photo.oy || 0) * photoBoxH
              }px) rotate(${photo.rotation || 0}deg) scale(${photo.flipH ? -1 : 1}, ${photo.flipV ? -1 : 1})`,
            }}
          />
        ) : null}
      </div>

      {hasCaption && (
        <div
          className="absolute inset-x-0 flex flex-col items-center justify-center px-[8%]"
          style={{ bottom: 0, height: `${ratios.caption * 100}%` }}
        >
          {element ? (
            <span
              className="select-none leading-none"
              style={{
                fontFamily: captionFont(style),
                fontSize: size.w * (style.size ?? 0.062) * 0.8,
                color: style.color || "#1A1614",
              }}
            >
              {element}
            </span>
          ) : null}
          {editable ? (
            <textarea
              value={photo.caption || ""}
              onChange={(event) => onCaptionChange?.(event.target.value)}
              maxLength={220}
              rows={2}
              placeholder="Escreva aqui"
              className="w-full resize-none border-0 bg-transparent p-0 text-center outline-none placeholder:text-neutral-400"
              style={{
                color: style.color || "#1A1614",
                fontFamily: captionFont(style),
                fontSize: size.w * (style.size ?? 0.062),
                fontWeight: style.bold ? 600 : 400,
                lineHeight: 1.25,
                textAlign: style.align || "center",
              }}
            />
          ) : (
            <p
              className="line-clamp-3 w-full text-center"
              style={{
                color: style.color || "#1A1614",
                fontFamily: captionFont(style),
                fontSize: size.w * (style.size ?? 0.062),
                fontWeight: style.bold ? 600 : 400,
                lineHeight: 1.25,
                textAlign: style.align || "center",
                whiteSpace: "pre-wrap",
              }}
            >
              {photo.caption || ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}