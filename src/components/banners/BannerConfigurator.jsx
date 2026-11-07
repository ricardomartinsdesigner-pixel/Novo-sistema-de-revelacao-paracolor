import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Loader2, ShoppingBag, Upload } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { uid } from "@/lib/uid";
import { useEntityList } from "@/lib/store";
import { loadImage } from "@/lib/photo";
import { ART_ACCEPT, isPdfFile, prepareUploads } from "@/lib/upload-formats";
import { formatBRL } from "@/lib/areas";

export default function BannerConfigurator() {
  const { data: sizes = [] } = useEntityList("BannerSize", { active: true }, { sort: "sort" });
  const { data: options = [] } = useEntityList("BannerOption", { active: true }, { sort: "sort" });
  const { addItems } = useCart();
  const navigate = useNavigate();

  const [sizeId, setSizeId] = useState("");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [materialId, setMaterialId] = useState("");
  const [finishIds, setFinishIds] = useState([]);
  const [qty, setQty] = useState(1);
  const [artMode, setArtMode] = useState("upload");
  const [art, setArt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const SAFETY_CM = 3;

  const activeSize = sizes.find((size) => size.id === (sizeId || sizes[0]?.id)) || sizes[0];
  const materials = options.filter((option) => option.kind === "material");
  const finishes = options.filter((option) => option.kind !== "material");
  const activeMaterial = materials.find((item) => item.id === (materialId || materials[0]?.id)) || materials[0];

  const effective = activeSize && width && height ? { width, height } : { width: activeSize?.width_cm || 0, height: activeSize?.height_cm || 0 };
  const areaM2 = (effective.width * effective.height) / 10000;
  const safetyX = Math.min(40, (SAFETY_CM / (effective.width || 1)) * 100);
  const safetyY = Math.min(40, (SAFETY_CM / (effective.height || 1)) * 100);
  const finishTotal = finishes.filter((item) => finishIds.includes(item.id)).reduce((sum, item) => sum + (Number(item.price_fixed) || 0), 0);
  const unitPrice = activeSize
    ? Math.round(
        ((Number(activeSize.base_price) || 0) +
          areaM2 * ((Number(activeSize.price_per_m2) || 0) + (Number(activeMaterial?.price_per_m2) || 0)) +
          finishTotal) *
          100
      ) / 100
    : 0;

  const resolution = useMemo(() => {
    if (!art || !effective.width || art.pdf) return null;
    const dpi = Math.round(Math.min(art.w / (effective.width / 2.54), art.h / (effective.height / 2.54)));
    return dpi;
  }, [art, effective.width, effective.height]);

  async function handleArt(input) {
    if (!input) return;
    setBusy(true);
    try {
      const { files } = await prepareUploads([input]);
      const file = files[0];
      if (!file) throw new Error("Não foi possível converter o arquivo.");
      const pdf = isPdfFile(file);
      let preview = "";
      let w = 0;
      let h = 0;
      if (!pdf) {
        preview = URL.createObjectURL(file);
        const image = await loadImage(preview);
        w = image.naturalWidth;
        h = image.naturalHeight;
      }
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setArt({ name: file.name, preview, file_uri, w, h, pdf });
      toast.success(pdf ? "PDF enviado — será impresso como está" : "Arte enviada");
    } catch {
      toast.error("Não foi possível ler este arquivo. Envie em JPG, PNG, AVIF, HEIC ou PDF.");
    } finally {
      setBusy(false);
    }
  }

  function addToCart() {
    if (!activeSize) {
      toast.error("Nenhum tamanho de banner cadastrado ainda.");
      return;
    }
    if (!(effective.width >= 20 && effective.width <= 1000 && effective.height >= 20 && effective.height <= 1000)) {
      toast.error("Informe largura e altura entre 20 e 1000 cm.");
      return;
    }
    if (artMode === "upload" && !art) {
      toast.error("Envie a arte ou escolha a opção de criação pela equipe.");
      return;
    }
    addItems([
      {
        key: uid(),
        area: "banner",
        ref_id: activeSize.id,
        title: `Banner ${effective.width} x ${effective.height} cm`,
        subtitle: [activeMaterial?.name, ...finishes.filter((item) => finishIds.includes(item.id)).map((item) => item.name)].filter(Boolean).join(" · "),
        unitPrice,
        qty,
        photos: [],
        options: {
          width_cm: effective.width,
          height_cm: effective.height,
          material_id: activeMaterial?.id || "",
          finish_ids: finishIds,
          art_mode: artMode,
          art_file_uri: artMode === "upload" ? art?.file_uri || "" : "",
          art_original_name: artMode === "upload" ? art?.name || "" : "",
          art_approval_mode: artMode === "equipe" ? "obrigatoria" : "opcional",
          art_approval_requested: true,
          safety_margin_cm: SAFETY_CM,
          preview_uri: artMode === "upload" ? art?.file_uri || "" : "",
        },
      },
    ]);
    toast.success("Banner adicionado ao carrinho");
    navigate({ to: "/carrinho" });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <section className="rounded-[1.25rem] border border-border bg-card p-6">
          <h2 className="text-xl">1. Tamanho</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {sizes.map((size) => (
              <button
                type="button"
                key={size.id}
                onClick={() => {
                  setSizeId(size.id);
                  setWidth(size.width_cm);
                  setHeight(size.height_cm);
                }}
                className={`rounded-xl border p-3 text-left text-sm transition ${
                  (sizeId || sizes[0]?.id) === size.id ? "border-primary bg-accent/50" : "border-border hover:border-primary/40"
                }`}
              >
                {size.width_cm} x {size.height_cm} cm
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{size.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">
              Largura (cm)
              <input
                type="number"
                min="20"
                max="1000"
                value={effective.width || ""}
                onChange={(event) => {
                  setSizeId("");
                  setWidth(Number(event.target.value));
                }}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Altura (cm)
              <input
                type="number"
                min="20"
                max="1000"
                value={effective.height || ""}
                onChange={(event) => {
                  setSizeId("");
                  setHeight(Number(event.target.value));
                }}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
          </div>
        </section>

        <section className="rounded-[1.25rem] border border-border bg-card p-6">
          <h2 className="text-xl">2. Material e acabamento</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {materials.map((material) => (
              <label key={material.id} className={`cursor-pointer rounded-xl border p-3 text-sm ${(materialId || materials[0]?.id) === material.id ? "border-primary bg-accent/50" : "border-gold/50 bg-background hover:border-gold hover:bg-gold-soft/40"}`}>
                <input type="radio" name="material" className="mr-2 accent-primary" checked={(materialId || materials[0]?.id) === material.id} onChange={() => setMaterialId(material.id)} />
                {material.name}
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {material.price_per_m2 ? `+ ${formatBRL(material.price_per_m2)}/m²` : "incluso"}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {finishes.map((finish) => {
              const active = finishIds.includes(finish.id);
              return (
                <button
                  type="button"
                  key={finish.id}
                  onClick={() => setFinishIds((current) => (active ? current.filter((id) => id !== finish.id) : [...current, finish.id]))}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${active ? "border-primary bg-accent text-primary" : "border-gold/50 bg-background hover:border-gold hover:bg-gold-soft/40"}`}
                >
                  {finish.name} {finish.price_fixed ? `+ ${formatBRL(finish.price_fixed)}` : ""}
                </button>
              );
            })}
          </div>
          <label className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            Quantidade
            <input
              type="number"
              min="1"
              max="50"
              value={qty}
              onChange={(event) => setQty(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
              className="w-20 rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </label>
        </section>

        <section className="rounded-[1.25rem] border border-border bg-card p-6">
          <h2 className="text-xl">3. Arte</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setArtMode("upload")} className={`rounded-xl border p-3 text-left text-sm ${artMode === "upload" ? "border-primary bg-accent/50" : "border-gold/50 bg-background hover:border-gold hover:bg-gold-soft/40"}`}>
              Enviar arte pronta
              <span className="mt-0.5 block text-[11px] text-muted-foreground">JPG, PNG, AVIF, HEIC ou PDF</span>
            </button>
            <button type="button" onClick={() => setArtMode("equipe")} className={`rounded-xl border p-3 text-left text-sm ${artMode === "equipe" ? "border-primary bg-accent/50" : "border-gold/50 bg-background hover:border-gold hover:bg-gold-soft/40"}`}>
              Quero que a equipe crie
              <span className="mt-0.5 block text-[11px] text-muted-foreground">Enviamos a arte pelo WhatsApp para aprovar</span>
            </button>
          </div>

          {artMode === "upload" && (
            <div className="mt-4">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gold/60 p-4 text-sm hover:border-gold hover:bg-gold-soft/25 text-muted-foreground">
                <Upload className="h-4 w-4" />
                {art ? art.name : "Escolher arquivo da arte"}
                <input type="file" accept={ART_ACCEPT} className="hidden" onChange={(event) => handleArt(event.target.files?.[0])} />
              </label>
              {busy && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Enviando arte…</p>}
              {resolution !== null && (
                <p className={`mt-2 text-xs ${resolution < 100 ? "text-red-600" : "text-muted-foreground"}`}>
                  Resolução da arte neste tamanho: {resolution} DPI {resolution < 100 ? "— abaixo do recomendado (100 DPI)" : ""}
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <aside className="h-fit rounded-[1.25rem] border border-border bg-card p-6 lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="relative flex items-center justify-center overflow-hidden bg-secondary" style={{ aspectRatio: `${effective.width || 1} / ${effective.height || 1}` }}>
            {art && !art.pdf ? (
              <img src={art.preview} alt="Prévia do banner" className="h-full w-full object-cover" />
            ) : art?.pdf ? (
              <span className="flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground">
                <FileText className="h-6 w-6" strokeWidth={1.5} />
                PDF enviado — será impresso exatamente como está
              </span>
            ) : (
              <span className="p-6 text-center text-xs text-muted-foreground">Prévia ilustrativa do banner</span>
            )}
            {showGuide ? (
              <div
                className="pointer-events-none absolute border border-dashed border-amber-500/90"
                style={{ top: `${safetyY}%`, bottom: `${safetyY}%`, left: `${safetyX}%`, right: `${safetyX}%` }}
                aria-hidden="true"
              />
            ) : null}
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
            <span>{effective.width || 0} x {effective.height || 0} cm</span>
            <span>{(areaM2 || 0).toFixed(2)} m²</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowGuide((value) => !value)}
          className="mt-2 w-full rounded-lg border border-gold/50 px-3 py-1.5 text-[11px] text-foreground/80 transition hover:border-gold hover:bg-gold-soft hover:text-gold-deep"
        >
          {showGuide ? "Ocultar" : "Mostrar"} margem de segurança ({SAFETY_CM} cm)
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Mantenha textos, logos e rostos dentro da linha pontilhada: o acabamento pode cortar até {SAFETY_CM} cm de cada borda.
        </p>

        <div className="mt-4 space-y-1 text-sm">
          <p className="text-muted-foreground">Valor unitário</p>
          <p className="font-display text-3xl">{formatBRL(unitPrice)}</p>
          <p className="text-xs text-muted-foreground">Total: {formatBRL(unitPrice * qty)}</p>
        </div>

        <Button onClick={addToCart} size="lg" disabled={busy || !activeSize} className="mt-5 w-full rounded-full">
          <ShoppingBag className="mr-2 h-4 w-4" /> Adicionar ao carrinho
        </Button>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          O valor final é recalculado no servidor com a tabela da loja. A produção começa após a aprovação da arte.
        </p>
      </aside>
    </div>
  );
}