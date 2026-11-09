import { useRef, useState } from "react";
import { ImagePlus, ScanLine } from "lucide-react";
import { openToolImage } from "@/components/tools/open-tool-image";
import { PHOTO_ACCEPT } from "@/lib/upload-formats";
import { sizePrintInfo } from "@/lib/photo";
import { useEntityList } from "@/lib/store";
import { maxPrintSize, printFillPpi, PRINT_GOOD_PPI, PRINT_TARGET_PPI, resolutionLevel } from "@/lib/print-resolution";

const STANDARD_SIZES = [[10, 15], [13, 18], [15, 21]].map(([width_cm, height_cm]) => ({
  id: `${width_cm}x${height_cm}`, name: `${width_cm} × ${height_cm} cm`, width_cm, height_cm,
}));
const COLORS = {
  excelente: "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  adequada: "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  baixa: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  insuficiente: "bg-destructive/10 text-destructive",
};
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function printDimensions(photo, ppi) {
  const dimensions = maxPrintSize(photo.width, photo.height, ppi);
  return dimensions.some((cm) => cm < 0.1) ? "Abaixo de 0,1 cm em um dos lados" : `${dimensions.map((cm) => number.format(cm)).join(" × ")} cm`;
}

export default function ImageQualityTool() {
  const catalog = useEntityList("PhotoSize", { active: true }, { sort: "sort" });
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const analyzing = useRef(false);
  const sizes = catalog.data?.length ? catalog.data : STANDARD_SIZES;
  const results = photo ? sizes.map((size) => {
    const { widthCm, heightCm } = sizePrintInfo(size);
    const ppi = printFillPpi(photo.width, photo.height, widthCm, heightCm);
    return { ...size, ppi, area: widthCm * heightCm, ...resolutionLevel(ppi) };
  }) : [];
  const recommended = results.filter(({ ppi }) => ppi >= PRINT_GOOD_PPI).sort((a, b) => b.area - a.area || b.ppi - a.ppi)[0];

  async function analyze(file) {
    if (!file || analyzing.current) return;
    analyzing.current = true;
    setBusy(true);
    setPhoto(null);
    setError("");
    try {
      const { url, image } = await openToolImage(file);
      URL.revokeObjectURL(url);
      setPhoto({ name: file.name, width: image.naturalWidth, height: image.naturalHeight });
    } catch {
      setError(`Não foi possível abrir ${file.name}. Escolha uma imagem válida em JPG, PNG, HEIC ou WebP.`);
    } finally {
      analyzing.current = false;
      setBusy(false);
    }
  }

  return <section className="card-glass p-5">
    <h2 className="flex items-center gap-2 text-sm font-medium"><ScanLine className="h-4 w-4" /> Qualidade para revelação</h2>
    <p className="mt-1 text-[11px] text-muted-foreground">
      Descubra até que tamanho revelar sua foto com boa resolução. A análise usa os pixels do arquivo, sem enviar a foto.
    </p>
    <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gold/60 px-3 py-6 text-xs hover:border-gold">
      <ImagePlus className="h-4 w-4" /> {busy ? "Analisando imagem…" : "Escolher imagem para verificar"}
      <input type="file" accept={PHOTO_ACCEPT} disabled={busy} className="sr-only" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        void analyze(file);
      }} />
    </label>
    {busy && <p role="status" className="mt-3 text-xs text-muted-foreground">Lendo a resolução da imagem…</p>}
    {error && <p role="alert" className="mt-3 break-words text-xs text-destructive">{error}</p>}
    {photo && <div className="mt-4 space-y-3 text-xs" aria-live="polite">
      <p className="break-words"><strong>{photo.name}</strong> · {photo.width} × {photo.height} pixels</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-primary/30 bg-accent/50 p-3">
          <p>Máximo com boa nitidez</p><p className="mt-1 font-semibold">{printDimensions(photo, PRINT_GOOD_PPI)}</p><p>{PRINT_GOOD_PPI} ppi</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p>Máximo para maior nitidez</p><p className="mt-1 font-semibold">{printDimensions(photo, PRINT_TARGET_PPI)}</p><p>{PRINT_TARGET_PPI} ppi</p>
        </div>
      </div>
      <p><strong>Maior formato recomendado {catalog.data?.length ? "da loja" : "da lista"}</strong>{" · "}
        {recommended ? `${recommended.name} (${recommended.ppi} ppi)` : "Escolha um tamanho menor para obter boa nitidez."}</p>
      <ul className="max-h-44 space-y-1 overflow-y-auto">
        {results.map(({ id, name, ppi, label, level }) => <li key={id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5">
          <span>{name}</span><span className={`shrink-0 rounded px-2 py-1 ${COLORS[level]}`}>{label} · {ppi} ppi</span>
        </li>)}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Os limites em centímetros mantêm a proporção da foto. Os formatos da loja consideram o recorte para preencher o papel.
        Desfoque e compressão também afetam a nitidez.
      </p>
    </div>}
  </section>;
}
