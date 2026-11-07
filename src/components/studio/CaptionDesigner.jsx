import { useMemo } from "react";
import { CAPTION_COLORS, CAPTION_ELEMENTS, CAPTION_EMOJIS, CAPTION_FONTS } from "@/lib/caption-style";
import { fitCaptionSize, measureCaption } from "@/lib/polaroid";

export default function CaptionDesigner({ caption = "", style = {}, model, onCaption, onStyle }) {
  const setStyle = (patch) => onStyle({ ...style, ...patch });
  const check = useMemo(
    () => measureCaption({ caption, captionStyle: style }, model),
    [caption, style, model]
  );
  const fixSize = () => setStyle({ size: fitCaptionSize({ caption, captionStyle: style }, model) });
  const append = (text) => {
    const base = caption.trimEnd();
    onCaption(`${base}${base ? " " : ""}${text}`.slice(0, 220));
  };

  return (
    <div className="mt-4 space-y-4">
      {caption.trim() && !check.fits ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <p className="text-xs font-medium">
            {check.truncated > 0
              ? `A escrita ocupa ${check.lineCount} linhas e a impressão mostra ${check.maxLines}.`
              : "A escrita está grande demais para a área branca da polaroid."}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-800/90">
            Reduza a fonte para o texto inteiro sair na foto — do contrário ele é cortado.
          </p>
          <button
            type="button"
            onClick={fixSize}
            className="mt-2 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-900 transition hover:border-amber-400"
          >
            Reduzir para caber
          </button>
        </div>
      ) : null}

      <div>
        <p className="eyebrow">Emojis</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {CAPTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => append(emoji)}
              className="rounded-lg border border-gold/50 px-2 py-1 text-base leading-none transition hover:border-gold hover:bg-gold-soft"
              aria-label={`Adicionar ${emoji} na legenda`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow">Elementos decorativos</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CAPTION_ELEMENTS.map((element) => {
            const active = (style.element || "none") === element.value;
            return (
              <button
                key={element.value}
                type="button"
                onClick={() => setStyle({ element: element.value })}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  active ? "border-primary bg-accent text-primary" : "border-gold/55 bg-gold-soft/45 text-foreground hover:border-gold"
                }`}
              >
                {element.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="eyebrow">Fonte da escrita</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {CAPTION_FONTS.map((font) => {
            const active = (style.font || "hand") === font.value;
            return (
              <button
                key={font.value}
                type="button"
                onClick={() => setStyle({ font: font.value })}
                aria-pressed={active}
                className={`rounded-lg border px-1.5 py-2 leading-tight transition ${
                  active ? "border-primary bg-accent text-primary" : "border-gold/55 bg-gold-soft/45 text-foreground hover:border-gold"
                }`}
              >
                <span className="block truncate text-lg leading-none" style={{ fontFamily: font.stack }}>Aa</span>
                <span className="mt-1 block text-[10px] leading-tight">{font.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <label className="block text-xs text-muted-foreground">
        Alinhamento
        <select
          value={style.align || "center"}
          onChange={(event) => setStyle({ align: event.target.value })}
          className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground"
        >
          <option value="left">Esquerda</option>
          <option value="center">Centralizado</option>
          <option value="right">Direita</option>
        </select>
      </label>

      <div>
        <p className="eyebrow">Cor da legenda</p>
        <div className="mt-2 flex items-center gap-1.5">
          {CAPTION_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setStyle({ color })}
              aria-label={`Cor ${color}`}
              className={`h-6 w-6 rounded-full border transition ${
                (style.color || "#1A1614").toLowerCase() === color.toLowerCase() ? "border-primary ring-2 ring-primary/30" : "border-gold/60"
              }`}
              style={{ background: color }}
            />
          ))}
          <input
            type="color"
            value={style.color || "#1A1614"}
            onChange={(event) => setStyle({ color: event.target.value })}
            className="h-7 w-9 rounded border border-input bg-background"
            aria-label="Outra cor"
          />
        </div>
      </div>

      <label className="block text-xs text-muted-foreground">
        Tamanho do texto
        <input
          type="range"
          min="0.03"
          max="0.11"
          step="0.005"
          value={style.size ?? 0.062}
          onChange={(event) => setStyle({ size: Number(event.target.value) })}
          className="mt-2 h-1.5 w-full accent-primary"
        />
        <span className="mt-1 block text-[11px] text-muted-foreground">
          Até 3 linhas aparecem na impressão. Cursivas ficam melhores a partir de 60%.
        </span>
      </label>
    </div>
  );
}