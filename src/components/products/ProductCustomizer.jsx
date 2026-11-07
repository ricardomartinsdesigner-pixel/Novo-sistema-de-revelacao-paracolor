import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileText, ImagePlus, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { loadImage } from "@/lib/photo";
import { ART_ACCEPT, isPdfFile, prepareUploads } from "@/lib/upload-formats";
import { uid } from "@/lib/uid";
import { formatBRL } from "@/lib/areas";
import { useSettings } from "@/lib/store";
import { effectivePrice } from "@/lib/promo";
import ProductPreview from "@/components/products/ProductPreview";

export default function ProductCustomizer({ product }) {
  const { addItems } = useCart();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const photoFields = product.photo_fields?.length
    ? product.photo_fields
    : [{ label: "Foto para o produto", required: true, instructions: "" }];
  const textFields = product.text_fields ?? [];
  const addons = product.addons ?? [];
  const variations = product.variations ?? [];

  const [photos, setPhotos] = useState({});
  const [texts, setTexts] = useState({});
  const [addonSelection, setAddonSelection] = useState([]);
  const [variationSelection, setVariationSelection] = useState(() => {
    const initial = {};
    variations.forEach((variation) => {
      initial[variation.name] = variation.options?.[0]?.label ?? variation.options?.[0] ?? "";
    });
    return initial;
  });
  const [approval, setApproval] = useState(product.art_approval_mode === "obrigatoria" ? "sim" : "sim");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState("");

  const unitPrice = useMemo(() => {
    let total = effectivePrice(product, settings);
    variations.forEach((variation) => {
      const chosen = variationSelection[variation.name];
      const option = (variation.options ?? []).find(
        (candidate) => (typeof candidate === "string" ? candidate : candidate.label) === chosen
      );
      if (option && typeof option === "object") total += Number(option.price_delta) || 0;
    });
    addons.forEach((addon) => {
      if (addonSelection.includes(addon.label)) total += Number(addon.price) || 0;
    });
    return Math.round(total * 100) / 100;
  }, [product, settings, variations, variationSelection, addons, addonSelection]);

  async function handlePhoto(index, input) {
    if (!input) return;
    setBusy(`photo-${index}`);
    try {
      const { files } = await prepareUploads([input]);
      const file = files[0];
      if (!file) throw new Error("Não foi possível converter a foto do iPhone.");
      const pdf = isPdfFile(file);
      const preview = pdf ? "" : URL.createObjectURL(file);
      const image = pdf ? null : await loadImage(preview);
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setPhotos((current) => ({
        ...current,
        [index]: {
          name: file.name,
          preview,
          file_uri,
          kind: pdf ? "pdf" : "image",
          w: image?.naturalWidth || 0,
          h: image?.naturalHeight || 0,
        },
      }));
      toast.success(pdf ? "PDF enviado — será impresso como está" : "Foto adicionada");
    } catch {
      toast.error("Não foi possível ler este arquivo. Envie em JPG, PNG, AVIF, HEIC ou PDF.");
    } finally {
      setBusy("");
    }
  }

  function addToCart() {
    for (let index = 0; index < photoFields.length; index += 1) {
      if (photoFields[index].required && !photos[index]) {
        toast.error(`Envie a foto do campo “${photoFields[index].label}”.`);
        return;
      }
    }
    for (const field of textFields) {
      if (field.required && !(texts[field.label] || "").trim()) {
        toast.error(`Preencha o campo “${field.label}”.`);
        return;
      }
    }

    const firstVariation = variations[0];
    addItems([
      {
        key: uid(),
        area: "personalizado",
        ref_id: product.id,
        title: product.name,
        subtitle: [firstVariation ? `${firstVariation.name}: ${variationSelection[firstVariation.name]}` : "", addonSelection.join(", ")]
          .filter(Boolean)
          .join(" · "),
        unitPrice,
        qty,
        photos: Object.entries(photos).map(([index, photo]) => ({
          filename: photo.name,
          original_file_uri: photo.file_uri,
          size_name: photoFields[index]?.label || "Foto",
          preview: photo.preview,
        })),
        options: {
          variation_name: firstVariation?.name || "",
          variation_option: firstVariation ? variationSelection[firstVariation.name] : "",
          variations: variationSelection,
          addons: addonSelection,
          text_values: texts,
          photo_labels: photoFields.map((field) => field.label),
          art_approval_mode: product.art_approval_mode || "desativada",
          art_approval_requested: product.art_approval_mode === "obrigatoria" ? true : approval === "sim",
          product_code: product.code || "",
          preview_uri: photos[0]?.file_uri || "",
        },
      },
    ]);
    toast.success("Produto adicionado ao carrinho");
    navigate({ to: "/carrinho" });
  }

  return (
    <div className="space-y-6">
      <ProductPreview product={product} photos={photos} textFields={textFields} texts={texts} />

      {variations.map((variation) => (
        <div key={variation.name}>
          <p className="eyebrow">{variation.name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(variation.options ?? []).map((option) => {
              const label = typeof option === "string" ? option : option.label;
              const delta = typeof option === "object" ? Number(option.price_delta) || 0 : 0;
              const active = variationSelection[variation.name] === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setVariationSelection((current) => ({ ...current, [variation.name]: label }))}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${active ? "border-primary bg-accent text-primary" : "border-gold/55 bg-gold-soft/45 text-foreground hover:border-gold"}`}
                >
                  {label} {delta ? `+ ${formatBRL(delta)}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <p className="eyebrow">Fotos para personalizar</p>
        <div className="mt-2 space-y-2">
          {photoFields.map((field, index) => (
            <label key={`${field.label}-${index}`} className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gold/60 p-3 text-sm hover:border-gold hover:bg-gold-soft/25">
              <span className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-lg bg-secondary">
                {photos[index] ? (
                  photos[index].kind === "pdf" ? (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <img src={photos[index].preview} alt="" className="h-full w-full object-cover" />
                  )
                ) : busy === `photo-${index}` ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm">
                  {field.label} {field.required ? <span className="text-red-600">*</span> : null}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {photos[index]?.name || field.instructions || "Escolher foto"}
                </span>
              </span>
              <input
                type="file"
                accept={ART_ACCEPT}
                className="hidden"
                onChange={(event) => handlePhoto(index, event.target.files?.[0])}
              />
            </label>
          ))}
        </div>
      </div>

      {textFields.length > 0 && (
        <div>
          <p className="eyebrow">Textos</p>
          <div className="mt-2 space-y-3">
            {textFields.map((field) => (
              <label key={field.label} className="block text-xs text-muted-foreground">
                {field.label} {field.required ? <span className="text-red-600">*</span> : null}
                <input
                  value={texts[field.label] || ""}
                  maxLength={field.max_length || 120}
                  onChange={(event) => setTexts((current) => ({ ...current, [field.label]: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
                <span className="mt-0.5 block text-[10px]">
                  {(texts[field.label] || "").length}/{field.max_length || 120} caracteres
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {addons.length > 0 && (
        <div>
          <p className="eyebrow">Adicionais</p>
          <div className="mt-2 space-y-2">
            {addons.map((addon) => (
              <label key={addon.label} className="flex items-center justify-between gap-3 rounded-xl border border-gold/45 bg-background p-3 text-sm hover:border-gold">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={addonSelection.includes(addon.label)}
                    onChange={(event) =>
                      setAddonSelection((current) =>
                        event.target.checked ? [...current, addon.label] : current.filter((label) => label !== addon.label)
                      )
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  {addon.label}
                </span>
                <span className="text-xs text-muted-foreground">+ {formatBRL(addon.price || 0)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {product.art_approval_mode && product.art_approval_mode !== "desativada" && (
        <div className="rounded-xl bg-secondary/60 p-4">
          <p className="text-sm font-medium">
            {product.art_approval_mode === "obrigatoria"
              ? "Este produto exige aprovação da arte antes da produção."
              : "Deseja receber a arte pelo WhatsApp para aprovar antes da produção?"}
          </p>
          {product.art_approval_mode === "opcional" ? (
            <div className="mt-2 space-y-1.5 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={approval === "sim"} onChange={() => setApproval("sim")} className="accent-primary" /> Sim, quero aprovar
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={approval === "nao"} onChange={() => setApproval("nao")} className="accent-primary" /> Não preciso aprovar
              </label>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Você recebe a arte no WhatsApp e a produção só começa depois da sua aprovação.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">
            Qtd
            <input
              type="number"
              min="1"
              max="99"
              value={qty}
              onChange={(event) => setQty(Math.max(1, Math.min(99, Math.trunc(Number(event.target.value) || 1))))}
              className="ml-2 w-16 rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <div>
            <p className="text-[11px] text-muted-foreground">Total</p>
            <p className="font-display text-2xl">{formatBRL(unitPrice * qty)}</p>
          </div>
        </div>
        <Button size="lg" onClick={addToCart} disabled={Boolean(busy)} className="rounded-full">
          <ShoppingBag className="mr-2 h-4 w-4" /> Adicionar ao carrinho
        </Button>
      </div>
    </div>
  );
}