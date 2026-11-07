import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  FlipHorizontal,
  FlipVertical,
  Grid3x3,
  Maximize2,
  RotateCcw,
  RotateCw,
  Redo2,
  Undo2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import PolaroidPreview from "@/components/studio/PolaroidPreview";
import CaptionFullscreen from "@/components/studio/CaptionFullscreen";
import CropStage from "@/components/studio/CropStage";
import CaptionDesigner from "@/components/studio/CaptionDesigner";
import {
  ALERT_LABELS,
  autoCorrect,
  clampPhoto,
  computeLayout,
  evaluatePhoto,
  sizePrintInfo,
} from "@/lib/photo";
import { fitCaptionSize, measureCaption, polaroidGeometry } from "@/lib/polaroid";
export default function CropEditor({ photo, sizes, mode, onClose, onSave }) {
  const [draft, setDraft] = useState(photo);
  const [tick, setTick] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [applyCaptionAll, setApplyCaptionAll] = useState(false);
  const [applyCropAll, setApplyCropAll] = useState(false);
  const [captionScreen, setCaptionScreen] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const draftRef = useRef(photo);
  const past = useRef([]);
  const future = useRef([]);
  const pointers = useRef(new Map());
  const dragRef = useRef(null);
  const pinchRef = useRef(null);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setStage({ w: rect.width, h: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    function onWheel(event) {
      event.preventDefault();
      setDraft((current) => clampPhoto({ ...current, zoom: Math.min(6, Math.max(0.4, (current.zoom || 1) - event.deltaY * 0.0012)) }));
    }
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const polaroidModel = sizes.find((size) => size.id === draft.sizeId);
  const captionEnabled = polaroidModel?.has_caption !== false;
  const evaluation = evaluatePhoto(draft);
  const alerts = evaluation.alerts.filter((alert) => !(draft.confirmed && draft.confirmed.includes(alert)));

  function commit(patch, { reset = false } = {}) {
    past.current = [...past.current.slice(-40), draft];
    future.current = [];
    setDraft(clampPhoto({ ...(reset ? { ...draft, zoom: 1, ox: 0, oy: 0, rotation: 0, flipH: false, flipV: false } : draft), ...patch }));
    setTick((value) => value + 1);
  }

  function undo() {
    if (!past.current.length) return;
    const previous = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    future.current = [...future.current, draft];
    setDraft(previous);
    setTick((value) => value + 1);
  }

  function redo() {
    if (!future.current.length) return;
    const next = future.current[future.current.length - 1];
    future.current = future.current.slice(0, -1);
    past.current = [...past.current, draft];
    setDraft(next);
    setTick((value) => value + 1);
  }

  function changeSize(sizeId) {
    const size = sizes.find((item) => item.id === sizeId);
    if (!size) return;
    const dims = sizePrintInfo(size);
    if (mode === "polaroid") {
      // Área de foto quadrada: largura menos as margens laterais do papel.
      const geo = polaroidGeometry(size);
      commit({ sizeId: size.id, sizeLabel: size.name, wCm: geo.width, hCm: geo.height, dpi: dims.dpi, aspect: 1, printW: geo.side, printH: geo.side, border: false, price: size.price, polaroidModel: size.id, model: size });
    } else {
      commit({
        sizeId: size.id,
        sizeLabel: size.name,
        wCm: dims.widthCm,
        hCm: dims.heightCm,
        dpi: dims.dpi,
        aspect: dims.widthCm / dims.heightCm,
        printW: dims.widthCm,
        printH: dims.heightCm,
        price: size.price,
        borderPrice: size.border_price || 0,
      });
    }
  }

  // O quadro é calculado em pixels a partir do espaço livre: a maior caixa com a
  // proporção exata do formato escolhido. Nada de proporção vinda do CSS.
  function frameBox(item) {
    const aspect = Number(item.aspect) > 0 ? Number(item.aspect) : 1;
    // A folga de 72px mantém a mesa visível em volta do papel e abre espaço para
    // as réguas em centímetros acima e à esquerda.
    const availW = Math.max(96, (stage.w || 360) - 72);
    const availH = Math.max(96, (stage.h || 460) - 72);
    const w = Math.min(availW, availH * aspect);
    return { w, h: w / aspect };
  }

  // A área útil é o quadro menos a margem branca: é ela que recebe o zoom e o
  // deslocamento, tanto na prévia quanto no arquivo de impressão.
  function innerSize(item) {
    const box = frameBox(item);
    const pad = item.border && mode !== "polaroid" ? Math.min(box.w, box.h) * 0.045 : 0;
    return { w: Math.max(1, box.w - pad * 2), h: Math.max(1, box.h - pad * 2), pad };
  }

  // Cada gesto guarda o próprio ponto de partida: nada é lido de refs dentro do
  // atualizador de estado, então soltar o dedo no meio do arraste não quebra nada.
  function anchor(item) {
    return { base: item, ox: item.ox || 0, oy: item.oy || 0, zoom: item.zoom || 1, saved: false };
  }

  function applyGesture(gesture, patch) {
    const next = clampPhoto({ ...draftRef.current, ...patch });
    if (!gesture.saved) {
      const moved =
        next.ox !== (gesture.base.ox || 0) || next.oy !== (gesture.base.oy || 0) || next.zoom !== (gesture.base.zoom || 1);
      if (moved) {
        gesture.saved = true;
        past.current = [...past.current.slice(-40), gesture.base];
        future.current = [];
      }
    }
    draftRef.current = next;
    setDraft(next);
  }

  function startDrag(event) {
    const element = frameRef.current;
    if (!element) return;
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Alguns navegadores recusam a captura; o arraste continua funcionando.
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setDragging(true);
    const base = draftRef.current;
    if (pointers.current.size === 1) {
      pinchRef.current = null;
      dragRef.current = { ...anchor(base), x: event.clientX, y: event.clientY };
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchRef.current = { ...anchor(base), distance: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      dragRef.current = null;
    }
  }

  function moveDrag(event) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2) {
      const pinch = pinchRef.current;
      if (!pinch) return;
      const [a, b] = Array.from(pointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      applyGesture(pinch, {
        zoom: Math.min(6, Math.max(0.4, pinch.zoom * (distance / pinch.distance))),
      });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const size = innerSize(draftRef.current);
    applyGesture(drag, {
      ox: drag.ox + (event.clientX - drag.x) / size.w,
      oy: drag.oy + (event.clientY - drag.y) / size.h,
    });
  }

  function endDrag(event) {
    pointers.current.delete(event.pointerId);
    const element = frameRef.current;
    if (element?.hasPointerCapture?.(event.pointerId)) {
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {
        // O navegador já liberou o ponteiro.
      }
    }
    if (pointers.current.size >= 2) return;
    pinchRef.current = null;
    if (pointers.current.size === 0) {
      dragRef.current = null;
      setDragging(false);
      return;
    }
    // Sobrou um dedo na tela: ele continua arrastando a partir do ponto atual.
    const remaining = Array.from(pointers.current.values())[0];
    dragRef.current = { ...anchor(draftRef.current), x: remaining.x, y: remaining.y, saved: true };
  }

  // A prévia usa a mesma geometria do arquivo de impressão.
  const box = frameBox(draft);
  const inner = innerSize(draft);
  const inset = inner.pad;
  const innerW = inner.w;
  const innerH = inner.h;
  const layout = computeLayout({
    imgW: draft.w || 1,
    imgH: draft.h || 1,
    aspect: innerW / innerH,
    zoom: draft.zoom || 1,
    rotation: draft.rotation || 0,
    fit: draft.fit || "cover",
  });
  const rotation = draft.rotation || 0;
  const baseAngle = Math.round(rotation / 90) * 90;
  const tilt = Math.round((rotation - baseAngle) * 10) / 10;
  const scalePx = innerW / layout.frameW;
  const drawW = layout.drawW * scalePx;
  const drawH = layout.drawH * scalePx;
  const imageStyle = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: drawW,
    height: drawH,
    maxWidth: "none",
    // A caixa segue a conta do recorte; o encaixe da imagem é sempre o do próprio
    // arquivo (cover/contain). Nunca estica, mesmo que a medida informada no envio
    // venha trocada pelo giro do celular.
    objectFit: draft.fit === "contain" ? "contain" : "cover",
    objectPosition: "center",
    transform: `translate(-50%, -50%) translate(${(draft.ox || 0) * innerW}px, ${
      (draft.oy || 0) * innerH
    }px) rotate(${draft.rotation || 0}deg) scale(${draft.flipH ? -1 : 1}, ${draft.flipV ? -1 : 1})`,
    userSelect: "none",
    pointerEvents: "none",
  };

  // A legenda nunca é impressa cortada: se não couber, a fonte é reduzida até caber.
  function save() {
    const next = {
      ...draft,
      quality: evaluation.quality,
      alerts,
      achievedDpi: evaluation.dpi,
      qualityLabel: evaluation.alerts.includes("resolucao_insuficiente")
        ? "Insuficiente"
        : evaluation.alerts.includes("resolucao_baixa")
          ? "Baixa"
          : evaluation.dpi >= 300
            ? "Excelente"
            : "Adequada",
    };
    if (mode === "polaroid" && captionEnabled && String(next.caption || "").trim()) {
      if (!measureCaption(next, polaroidModel).fits) {
        next.captionStyle = { ...(next.captionStyle || {}), size: fitCaptionSize(next, polaroidModel) };
        toast.info("Fonte da escrita reduzida para o texto caber na polaroid.");
      }
    }
    onSave(next, { applyCaptionAll: applyCaptionAll && captionEnabled, applyCropAll });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] w-[96vw] max-w-5xl overflow-y-auto p-0">
        <div className="border-b border-border px-6 py-4">
          <DialogTitle className="font-display text-xl">Ajustar enquadramento</DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Arraste a foto para posicionar · pinça ou roda do mouse para o zoom · use a inclinação para endireitar
          </p>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_260px]">
          <div>
            <CropStage
              photo={draft}
              box={box}
              inset={inset}
              innerW={innerW}
              innerH={innerH}
              imageStyle={imageStyle}
              showGrid={showGrid}
              showOriginal={showOriginal}
              dragging={dragging}
              stageRef={stageRef}
              frameRef={frameRef}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="icon" variant="outline" onClick={undo} aria-label="Desfazer"><Undo2 className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={redo} aria-label="Refazer"><Redo2 className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => commit({ rotation: ((draft.rotation || 0) - 90 + 360) % 360 })} aria-label="Girar à esquerda"><RotateCcw className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => commit({ rotation: ((draft.rotation || 0) + 90) % 360 })} aria-label="Girar à direita"><RotateCw className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => commit({ flipH: !draft.flipH })} aria-label="Espelhar horizontalmente"><FlipHorizontal className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => commit({ flipV: !draft.flipV })} aria-label="Espelhar verticalmente"><FlipVertical className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => setShowGrid((value) => !value)} aria-label="Grade de terços"><Grid3x3 className={`h-4 w-4 ${showGrid ? "text-primary" : ""}`} /></Button>
              <Button size="icon" variant="outline" onClick={() => commit({}, { reset: true })} aria-label="Restaurar original"><ArrowLeftRight className="h-4 w-4" /></Button>
              <Button
                size="sm"
                variant="ghost"
                onPointerDown={() => setShowOriginal(true)}
                onPointerUp={() => setShowOriginal(false)}
                onPointerLeave={() => setShowOriginal(false)}
              >
                Ver original
              </Button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <ZoomOut className="h-4 w-4 text-muted-foreground" />
              <input
                type="range"
                min="0.4"
                max="4"
                step="0.01"
                value={draft.zoom || 1}
                onChange={(event) => setDraft(clampPhoto({ ...draft, zoom: Number(event.target.value) }))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
                aria-label="Zoom"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
              <span className="w-10 text-right text-xs text-muted-foreground">{Math.round((draft.zoom || 1) * 100)}%</span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <RotateCw className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                type="range"
                min="-45"
                max="45"
                step="0.1"
                value={tilt}
                onChange={(event) =>
                  setDraft((current) => {
                    const value = Number(event.target.value);
                    const base = Math.round((current.rotation || 0) / 90) * 90;
                    return clampPhoto({ ...current, rotation: ((base + value) % 360 + 360) % 360 });
                  })
                }
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
                aria-label="Inclinação da foto"
              />
              <span className="w-14 text-right text-xs text-muted-foreground">
                {tilt > 0 ? "+" : ""}
                {tilt}°
              </span>
              <button
                type="button"
                onClick={() => commit({ rotation: ((baseAngle % 360) + 360) % 360 })}
                disabled={!tilt}
                className="rounded-md border border-gold/50 px-2 py-1 text-[11px] text-foreground/80 transition hover:border-gold hover:bg-gold-soft disabled:opacity-40"
              >
                Endireitar
              </button>
            </div>

            {alerts.length > 0 && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4" aria-live="polite">
                <p className="text-sm font-medium text-red-700">Atenção no enquadramento</p>
                <ul className="mt-1 space-y-1 text-xs text-red-700/90">
                  {alerts.map((alert) => (
                    <li key={alert}>· {ALERT_LABELS[alert] || alert}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => commit(autoCorrect(draft))} className="gap-1.5">
                    <Wand2 className="h-3.5 w-3.5" /> Corrigir automaticamente
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => commit({ fit: "contain", zoom: 1, ox: 0, oy: 0 })}>
                    Usar foto inteira
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => commit({ confirmed: [...(draft.confirmed || []), ...alerts] })}
                  >
                    Manter assim
                  </Button>
                </div>
              </div>
            )}

            {mode === "polaroid" && (
              <div className="mt-6 rounded-xl border border-border bg-card p-5">
                <p className="eyebrow">Sua polaroid</p>
                {captionEnabled ? (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">Toque na área branca para escrever a legenda.</p>
                    <div className="mx-auto mt-4 w-full max-w-[260px]">
                      <PolaroidPreview
                        photo={draft}
                        model={polaroidModel}
                        editable
                        onCaptionChange={(caption) => setDraft({ ...draft, caption })}
                      />
                    </div>
                    <Button variant="outline" size="sm" className="mt-3 w-full gap-1.5" onClick={() => setCaptionScreen(true)}>
                      <Maximize2 className="h-3.5 w-3.5" /> Escrever em tela cheia
                    </Button>
                    <CaptionDesigner
                      caption={draft.caption || ""}
                      style={draft.captionStyle || {}}
                      model={polaroidModel}
                      onCaption={(caption) => setDraft({ ...draft, caption })}
                      onStyle={(captionStyle) => setDraft({ ...draft, captionStyle })}
                    />
                    <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm">Aplicar em todas as fotos</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          A escrita e o estilo valem para todas as polaroides deste envio.
                        </p>
                      </div>
                      <Switch
                        checked={applyCaptionAll}
                        onCheckedChange={setApplyCaptionAll}
                        aria-label="Aplicar esta escrita em todas as fotos"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">Este modelo não tem área para escrita.</p>
                    <div className="mx-auto mt-4 w-full max-w-[260px]">
                      <PolaroidPreview photo={draft} model={polaroidModel} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <p className="eyebrow">Formato</p>
              <select
                value={draft.sizeId}
                onChange={(event) => changeSize(event.target.value)}
                className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {sizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.name} · {size.width_cm}x{size.height_cm} cm
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="eyebrow">Ajuste</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => commit({ fit: "contain" })}
                  className={`rounded-lg border px-3 py-2 text-xs transition ${draft.fit === "contain" ? "border-primary bg-accent text-primary" : "border-gold/55 bg-gold-soft/45 text-foreground hover:border-gold"}`}
                >
                  Foto inteira
                </button>
                <button
                  type="button"
                  onClick={() => commit({ fit: "cover" })}
                  className={`rounded-lg border px-3 py-2 text-xs transition ${draft.fit !== "contain" ? "border-primary bg-accent text-primary" : "border-gold/55 bg-gold-soft/45 text-foreground hover:border-gold"}`}
                >
                  Preenchida
                </button>
              </div>
            </div>

            {mode !== "polaroid" && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Com borda branca</p>
                  <p className="text-[11px] text-muted-foreground">Margem de 4,5%</p>
                </div>
                <Switch checked={Boolean(draft.border)} onCheckedChange={(checked) => commit({ border: checked })} />
              </div>
            )}

            <div>
              <p className="eyebrow">Quantidade</p>
              <input
                type="number"
                min="1"
                max="50"
                value={draft.copies || 1}
                onChange={(event) => setDraft({ ...draft, copies: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })}
                className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
              <div>
                <p className="text-sm">Aplicar este enquadramento em todas</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Mesmo zoom, posição, giro e espelhamento nas outras fotos do envio.
                </p>
              </div>
              <Switch
                checked={applyCropAll}
                onCheckedChange={setApplyCropAll}
                aria-label="Aplicar este enquadramento em todas as fotos"
              />
            </div>

            <div className="rounded-xl bg-secondary/70 p-4 text-xs text-muted-foreground">
              <p>
                Resolução: <strong className="text-foreground">{evaluation.dpi} DPI</strong>
              </p>
              <p className="mt-1">
                Necessário: {Math.round(((draft.printW || draft.wCm) / 2.54) * (draft.dpi || 300))} x{" "}
                {Math.round(((draft.printH || draft.hCm) / 2.54) * (draft.dpi || 300))} px
              </p>
              <p className="mt-1">
                Sua foto: {draft.w} x {draft.h} px
              </p>
            </div>

            {mode === "polaroid" && captionEnabled && captionScreen && (
              <CaptionFullscreen
                photo={draft}
                model={polaroidModel}
                onCaption={(caption) => setDraft({ ...draft, caption })}
                onClose={() => setCaptionScreen(false)}
              />
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button className="flex-1" onClick={save}>Aplicar</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}