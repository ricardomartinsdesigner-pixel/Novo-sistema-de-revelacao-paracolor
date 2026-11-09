import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ImagePlus, Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/cart";
import { formatBRL } from "@/lib/areas";
import { useSettings, useEntityList } from "@/lib/store";
import { linesFromItems, photoCounts, pricingContext } from "@/lib/quantity-pricing";
import { useQuantityPricing } from "@/hooks/use-quantity-pricing";
import { useSiteContent } from "@/hooks/use-site-content";
import { uid } from "@/lib/uid";
import { MAX_ORDER_PHOTOS } from "@/lib/photo-order";
import { PHOTO_ACCEPT, prepareUploads } from "@/lib/upload-formats";

const DPI = 300;
const px = (cm) => Math.max(1, Math.round((Number(cm) || 0) * DPI / 2.54));
const filesFrom = (list) => Array.from(list || []).map((file) => ({ file, preview: URL.createObjectURL(file), name: file.name, copies: 1, caption: "" }));

function loadBitmap(file) {
  return createImageBitmap(file);
}

function cover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sx = (image.width - sourceWidth) / 2;
  const sy = (image.height - sourceHeight) / 2;
  ctx.drawImage(image, sx, sy, sourceWidth, sourceHeight, x, y, width, height);
}

function caption(ctx, value, box, style = {}) {
  const text = String(value || "").trim();
  if (!text) return;
  const font = style.font || "Arial";
  const color = style.color || "#222222";
  const align = style.align || "center";
  const max = Math.max(10, box.width * 0.86);
  let size = Math.max(16, Math.min(box.height * 0.28, box.width * 0.12));
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.font = `${style.bold ? "700 " : "400 "}${size}px "${font}"`;
  while (ctx.measureText(text).width > max && size > 12) {
    size -= 2;
    ctx.font = `${style.bold ? "700 " : "400 "}${size}px "${font}"`;
  }
  const x = align === "left" ? box.x + box.width * 0.08 : align === "right" ? box.x + box.width * 0.92 : box.x + box.width / 2;
  ctx.fillText(text, x, box.y + box.height / 2, max);
}

async function renderMagnet(file, product, style, textValue, textStyle) {
      const width = px(product.width_cm);
      const height = px(product.height_cm);
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      const image = await loadBitmap(file);
      ctx.fillStyle = style === "photo" ? "#ffffff" : product.frame_color || "#ffffff";
      ctx.fillRect(0, 0, width, height);
      let x = 0, y = 0, w = width, h = height;
      if (style === "border") {
        x = Math.round(width * 0.055); y = Math.round(height * 0.055);
        w = width - x * 2; h = height - y * 2;
      } else if (style === "polaroid") {
        x = Math.round(width * 0.075); y = Math.round(height * 0.075);
        w = width - x * 2;
        h = Math.round(height * (1 - (Number(product.caption_area) || 0.22) - 0.075 - 0.075));
      }
      cover(ctx, image, x, y, w, h);
      if (textValue?.trim()) {
        const captionY = style === "polaroid" ? y + h : style === "border" ? height - Math.round(height * 0.19) : height - Math.round(height * 0.2);
        const captionHeight = height - captionY;
        if (style === "photo") {
          ctx.fillStyle = "rgba(255,255,255,.84)";
          ctx.fillRect(0, captionY, width, captionHeight);
        }
        caption(ctx, textValue, { x: style === "polaroid" ? 0 : x, y: captionY, width: style === "polaroid" ? width : w, height: captionHeight }, textStyle);
      }
      image.close?.();
      return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(new File([blob], `ima-${product.name}.jpg`, { type: "image/jpeg" })) : reject(new Error("Não foi possível preparar a impressão.")), "image/jpeg", 0.96));
}

async function renderStripSheet(designs, entries) {
  const canvas = document.createElement("canvas");
  canvas.width = px(15.2); canvas.height = px(20);
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const stripH = px(20), side = px(.3), photo = px(4.4), top = px(.25), gap = px(.15), bottom = px(1.7);
  for (let stripIndex = 0; stripIndex < 3; stripIndex += 1) {
    const originX = px(stripIndex * 5.1);
    let currentY = top;
    const design = designs[stripIndex];
    for (let frame = 0; frame < 4; frame += 1) {
      const entry = entries[design.photoIndexes[frame]];
      const image = await loadBitmap(entry.file);
      cover(ctx, image, originX + side, currentY, photo, photo);
      image.close?.();
      currentY += photo + gap;
    }
    if (design.caption) caption(ctx, design.caption, { x: originX + side, y: stripH - bottom, width: photo, height: bottom }, design.captionStyle);
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(new File([blob], "kit-tirinhas-ima.jpg", { type: "image/jpeg" })) : reject(new Error("Não foi possível montar a folha do kit.")), "image/jpeg", 0.97));
}

async function uploadPrivate(file) {
  const result = await base44.integrations.Core.UploadPrivateFile({ file });
  const uri = result?.file_uri || result?.file?.file_uri || result?.uri;
  if (!uri) throw new Error("O envio do arquivo não retornou um endereço válido.");
  return uri;
}

export default function MagnetCreator() {
  const { data: catalog = [], isLoading } = useEntityList("MagnetProduct", { active: true }, { sort: "sort" });
  const { settings } = useSettings();
  const { content } = useSiteContent();
  const pricing = useQuantityPricing(false);
  const { items: cartItems, addItems } = useCart();
  const { isAuthenticated, navigateToLogin } = useAuth();
  const navigate = useNavigate();
  const [productId, setProductId] = useState("");
  const [entries, setEntries] = useState([]);
  const [repeatStrip, setRepeatStrip] = useState(true);
  const [captions, setCaptions] = useState(["", "", ""]);
  const [style, setStyle] = useState("photo");
  const [textStyle, setTextStyle] = useState({ font: "Arial", color: "#222222", align: "center", bold: false });
  const [kits, setKits] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const product = catalog.find((item) => item.id === productId) || null;
  const tiers = pricing.data.tiers.filter((tier) => tier.category === "magnet");
  const tierPrices = pricing.data.tierPrices.filter((price) => !price.category || price.category === "magnet");
  const groups = pricing.data.groups.filter((group) => group.category === "magnet");
  const lines = useMemo(() => [
    ...linesFromItems(cartItems),
    ...entries.map((entry) => ({ area: "magnet", sizeId: product?.id, copies: Number(entry.copies) || 1, kind: product?.kind })),
  ], [cartItems, entries, product]);
  const priceMap = useMemo(() => pricingContext({ tiers, tierPrices, groups, counts: photoCounts(lines) }).magnet, [tiers, tierPrices, groups, lines]);
  const perUnit = product?.kind === "strip_kit" ? Number(product.price) || 0 : (priceMap[product?.id]?.unit ?? Number(product?.price)) || 0;
  const count = entries.reduce((sum, entry) => sum + (Number(entry.copies) || 1), 0);
  const total = product?.kind === "strip_kit" ? perUnit * kits : perUnit * count;
  const readyProducts = catalog.filter((item) => {
    if (item.kind === "strip_kit") return Number(item.price) > 0;
    return Number(item.price) > 0 || tierPrices.some((price) => price.size_id === item.id && Number(price.unit_price) > 0);
  });

  function setFiles(list) {
    const next = filesFrom(list);
    const limit = product?.kind === "strip_kit" ? (repeatStrip ? 4 : 12) : MAX_ORDER_PHOTOS;
    if (next.length > limit) { next.slice(limit).forEach((entry) => URL.revokeObjectURL(entry.preview)); toast.error(`Escolha até ${limit} fotos.`); }
    setEntries(next.slice(0, limit));
  }

  function selectProduct(id) {
    const next = catalog.find((item) => item.id === id);
    entries.forEach((entry) => URL.revokeObjectURL(entry.preview));
    setProductId(id); setEntries([]); setMessage("");
    setStyle(next?.kind === "polaroid" ? "polaroid" : "photo");
    setCaptions(["", "", ""]);
  }

  function handleRepeatChange(value) {
    entries.forEach((entry) => URL.revokeObjectURL(entry.preview));
    setRepeatStrip(value);
    setEntries([]); setMessage("");
  }

  function updateEntry(index, patch) {
    setEntries((current) => current.map((entry, position) => position === index ? { ...entry, ...patch } : entry));
  }

  function removeEntry(index) {
    setEntries((current) => {
      URL.revokeObjectURL(current[index]?.preview);
      return current.filter((_, position) => position !== index);
    });
  }

  function stripDesigns() {
    if (repeatStrip) {
      return [0, 1, 2].map((index) => ({ photoIndexes: [0, 1, 2, 3], caption: captions[0], captionStyle: textStyle }));
    }
    return [0, 1, 2].map((index) => ({ photoIndexes: [index * 4, index * 4 + 1, index * 4 + 2, index * 4 + 3], caption: captions[index], captionStyle: textStyle }));
  }

  async function addSingle() {
    if (!isAuthenticated) { navigateToLogin(); return; }
    if (!product || !entries.length) { toast.error("Escolha o formato e envie as fotos."); return; }
    if (count < 1) return;
    if (!(perUnit > 0)) { toast.error("A loja ainda não configurou o preço deste formato."); return; }
    setBusy(true); setMessage("Preparando fotos para o pedido…");
    try {
      const prepared = await prepareUploads(entries.map((entry) => entry.file));
      if (prepared.files.length !== entries.length) throw new Error("Uma ou mais fotos não abriram. Tente JPG, PNG ou HEIC novamente.");
      const savedPhotos = [];
      for (const [index, entry] of entries.entries()) {
        const photoFile = prepared.files[index];
        const originalUri = await uploadPrivate(photoFile);
        const printFile = await renderMagnet(photoFile, product, style, entry.caption, textStyle);
        const printUri = await uploadPrivate(printFile);
        savedPhotos.push({
          filename: entry.name, original_file_uri: originalUri, print_file_uri: printUri,
          print_name: printFile.name, size_name: product.name, width_cm: Number(product.width_cm), height_cm: Number(product.height_cm),
          copies: Number(entry.copies) || 1, caption: entry.caption.slice(0, 60),
          caption_style: { ...textStyle }, caption_area_enabled: style === "polaroid", magnet_style: style,
          position: index,
          preview: entry.preview,
        });
      }
      const lineTotal = savedPhotos.reduce((sum, photo) => sum + perUnit * photo.copies, 0);
      if (!addItems([{
        key: uid(), area: "magnet", ref_id: product.id, title: `Ímã ${product.name}`,
        subtitle: `${style === "polaroid" ? "Estilo Polaroide" : style === "border" ? "Com borda branca" : "Foto inteira"} · ${count} unidade(s)`,
        unitPrice: Math.round(lineTotal * 100) / 100, qty: 1, photos: savedPhotos,
        options: { magnet_kind: product.kind, magnet_style: style, preview_uri: savedPhotos[0]?.print_file_uri || "" },
      }])) return;
      toast.success("Ímãs adicionados ao carrinho.");
      navigate({ to: "/carrinho" });
    } catch (error) { toast.error(error?.message || "Não foi possível preparar os ímãs."); }
    finally { setBusy(false); setMessage(""); }
  }

  async function addStripKit() {
    if (!isAuthenticated) { navigateToLogin(); return; }
    if (!product || entries.length !== (repeatStrip ? 4 : 12)) { toast.error(`Envie ${repeatStrip ? 4 : 12} fotos para montar as três tirinhas.`); return; }
    if (!(perUnit > 0)) { toast.error("Defina o preço fixo do kit no catálogo antes de vender."); return; }
    setBusy(true); setMessage("Montando folha 15,2 × 20 cm e enviando fotos…");
    try {
      const prepared = await prepareUploads(entries.map((entry) => entry.file));
      if (prepared.files.length !== entries.length) throw new Error("Uma ou mais fotos não abriram. Tente JPG, PNG ou HEIC novamente.");
      const printableEntries = entries.map((entry, index) => ({ ...entry, file: prepared.files[index] }));
      const designs = stripDesigns();
      const sheet = await renderStripSheet(designs, printableEntries);
      const sheetUri = await uploadPrivate(sheet);
      const savedPhotos = [];
      for (const [index, entry] of printableEntries.entries()) {
        const originalUri = await uploadPrivate(entry.file);
        savedPhotos.push({ filename: entry.name, original_file_uri: originalUri, size_name: `Tirinha ${repeatStrip ? "1–3" : Math.floor(index / 4) + 1} · Foto ${index % 4 + 1}`, width_cm: 4.4, height_cm: 4.4, copies: 1, position: index, preview: entry.preview });
      }
      const layout = { version: 1, sheet_cm: [15.2, 20], strip_cm: [5, 20], kits, repeated: repeatStrip, strips: designs.map((design) => ({ photo_indexes: design.photoIndexes, caption: design.caption })) };
      if (!addItems([{
        key: uid(), area: "magnet", ref_id: product.id, title: "Kit de 3 tirinhas magnéticas 5x20",
        subtitle: repeatStrip ? "3 tirinhas iguais" : "3 tirinhas personalizadas", unitPrice: perUnit, qty: kits,
        photos: savedPhotos, options: { magnet_kind: "strip_kit", magnet_style: "strip", magnet_print_sheet_uri: sheetUri, magnet_layout: JSON.stringify(layout), preview_uri: sheetUri },
      }])) return;
      toast.success("Kit de tirinhas adicionado ao carrinho.");
      navigate({ to: "/carrinho" });
    } catch (error) { toast.error(error?.message || "Não foi possível montar o kit de tirinhas."); }
    finally { setBusy(false); setMessage(""); }
  }

  if (isLoading) return <div className="container-x py-20 text-sm text-muted-foreground">Carregando formatos de ímã…</div>;
  if (settings?.module_fotos_ima === false) return <div className="container-x py-20 text-center">Esta área está temporariamente indisponível.</div>;
  const productVisible = product && readyProducts.some((item) => item.id === product.id);
  const requiredFiles = product?.kind === "strip_kit" ? (repeatStrip ? 4 : 12) : null;

  return (
    <div>
      <section className="band-gold border-b border-border/70">
        <div className="container-x grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="eyebrow">Personalize e monte seu pedido</p>
            <h1 className="mt-3 max-w-3xl text-4xl leading-tight sm:text-5xl">Fotos Ímã para guardar seus momentos</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">Escolha o formato, envie suas fotos, personalize as legendas e confira a prévia antes de colocar no carrinho.</p>
          </div>
          <figure className="overflow-hidden rounded-[1.25rem] border border-gold/40 bg-card/80 p-2 shadow-sm">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[0.9rem] bg-secondary/60">
              {content["page.fotos_ima.sample_image"] ? (
                <Image src={content["page.fotos_ima.sample_image"]} alt={content["page.fotos_ima.sample_image_alt"] || "Exemplos de fotos ímã personalizadas da Paracolor"} className="h-full w-full object-cover" fittingType="fill" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                  <ImagePlus className="h-8 w-8 text-gold-deep/70" strokeWidth={1.4} />
                  <span className="font-display text-lg">Foto de amostra</span>
                </div>
              )}
            </div>
          </figure>
        </div>
      </section>
      <section className="container-x grid gap-8 py-10 sm:py-14 lg:grid-cols-[1fr_360px]">
        <div className="space-y-7">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {readyProducts.map((item) => (
              <button key={item.id} type="button" onClick={() => selectProduct(item.id)} aria-pressed={productId === item.id}
                className={`rounded-2xl border p-4 text-left transition ${productId === item.id ? "border-primary bg-accent/40 shadow-sm" : "border-border bg-card hover:border-gold/70"}`}>
                <span className="text-[10px] uppercase tracking-[.16em] text-gold-deep">{item.kind === "strip_kit" ? "Kit com 3" : item.kind === "polaroid" ? "Polaroide magnética" : "Foto magnética"}</span>
                <span className="mt-1 block font-display text-xl">{item.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.kind === "strip_kit" ? "Folha pronta 15,2 × 20 cm" : `${item.width_cm} × ${item.height_cm} cm`}</span>
                <span className="mt-3 block text-sm font-medium">{item.kind === "strip_kit" ? Number(item.price) > 0 ? formatBRL(item.price) + " / kit" : "Preço a configurar" : Number(item.price) > 0 ? `A partir de ${formatBRL(item.price)} cada` : "Preço por faixa de quantidade"}</span>
              </button>
            ))}
          </div>

          {!readyProducts.length && <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">A loja está preparando os formatos e preços dos ímãs. Volte em breve.</div>}
          {productVisible && product.kind === "strip_kit" && <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-2xl">Monte suas três tirinhas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cada tirinha mede 5 × 20 cm e leva quatro fotos quadradas. O kit inclui três tirinhas magnéticas.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => handleRepeatChange(true)} className={`rounded-full border px-4 py-2 text-xs ${repeatStrip ? "border-primary bg-accent" : "border-border"}`}>Quero as três iguais</button>
              <button type="button" onClick={() => handleRepeatChange(false)} className={`rounded-full border px-4 py-2 text-xs ${!repeatStrip ? "border-primary bg-accent" : "border-border"}`}>Quero três diferentes</button>
            </div>
            <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gold/60 p-4 text-sm hover:bg-gold-soft/20">
              <ImagePlus className="h-5 w-5 text-gold-deep" />
              <span>{entries.length ? `${entries.length} de ${requiredFiles} fotos escolhidas` : `Escolha ${requiredFiles} fotos`}</span>
              <input className="hidden" type="file" accept={PHOTO_ACCEPT} multiple onChange={(event) => { setFiles(event.target.files); event.target.value = ""; }} />
            </label>
            {entries.length === requiredFiles && <div className="mt-5 grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((stripIndex) => {
                const indexes = repeatStrip ? [0, 1, 2, 3] : [stripIndex * 4, stripIndex * 4 + 1, stripIndex * 4 + 2, stripIndex * 4 + 3];
                return <div key={stripIndex} className="mx-auto w-full max-w-[180px] rounded-xl border border-border bg-secondary/40 p-3">
                  <div className="mx-auto flex w-[72px] flex-col gap-[3px] bg-white p-[4px] pb-5 shadow-sm">
                    {indexes.map((entryIndex) => <img key={`${stripIndex}-${entryIndex}`} src={entries[entryIndex]?.preview} alt="Foto da tirinha" className="aspect-square w-full object-cover" />)}
                    <div className="truncate px-1 text-center text-[6px] text-muted-foreground" style={{ color: textStyle.color, fontFamily: textStyle.font, fontWeight: textStyle.bold ? 700 : 400, textAlign: textStyle.align }}>{captions[stripIndex] || " "}</div>
                  </div>
                  <label className="mt-3 block text-[11px] text-muted-foreground">Legenda da tirinha {stripIndex + 1}
                    <input maxLength={50} value={captions[stripIndex]} onChange={(event) => setCaptions((current) => repeatStrip ? [event.target.value, event.target.value, event.target.value] : current.map((value, i) => i === stripIndex ? event.target.value : value))} className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground" placeholder="Nome, data ou frase" />
                  </label>
                </div>;
              })}
            </div>}
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <label className="block text-xs text-muted-foreground">Fonte<select value={textStyle.font} onChange={(event) => setTextStyle((current) => ({ ...current, font: event.target.value }))} className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-foreground"><option>Arial</option><option>Georgia</option><option>Courier New</option><option>cursive</option></select></label>
              <label className="block text-xs text-muted-foreground">Cor da escrita<input type="color" value={textStyle.color} onChange={(event) => setTextStyle((current) => ({ ...current, color: event.target.value }))} className="mt-1 block h-9 w-full rounded-lg border border-input bg-background p-1" /></label>
              <label className="block text-xs text-muted-foreground">Alinhamento<select value={textStyle.align} onChange={(event) => setTextStyle((current) => ({ ...current, align: event.target.value }))} className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-foreground"><option value="left">Esquerda</option><option value="center">Centralizado</option><option value="right">Direita</option></select></label>
              <label className="flex items-center gap-2 pt-5 text-xs text-muted-foreground"><input type="checkbox" checked={textStyle.bold} onChange={(event) => setTextStyle((current) => ({ ...current, bold: event.target.checked }))} /> Negrito</label>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block text-xs text-muted-foreground">Quantidade de kits
                <input type="number" min="1" max="99" value={kits} onChange={(event) => setKits(Math.max(1, Math.min(99, Math.trunc(Number(event.target.value) || 1))))} className="mt-1 block w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </label>
              <p className="text-right text-sm">Total: <strong className="font-display text-2xl">{formatBRL(total)}</strong></p>
            </div>
            {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
            <Button className="mt-5 w-full rounded-full" onClick={addStripKit} disabled={busy || entries.length !== requiredFiles || perUnit <= 0}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingBag className="mr-2 h-4 w-4" />}Adicionar kit ao carrinho
            </Button>
          </section>}

          {productVisible && product.kind !== "strip_kit" && <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-2xl">Personalize {product.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Envie uma foto para cada ímã e ajuste a quantidade de cópias.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {[{ id: "photo", label: "Foto inteira" }, { id: "border", label: "Borda branca" }, { id: "polaroid", label: "Estilo Polaroide" }].map((option) => <button key={option.id} type="button" onClick={() => setStyle(option.id)} className={`rounded-xl border p-3 text-xs ${style === option.id ? "border-primary bg-accent" : "border-border"}`}>{option.label}</button>)}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gold/60 p-4 text-sm"><ImagePlus className="h-5 w-5 text-gold-deep" />Adicionar fotos
                <input className="hidden" type="file" accept={PHOTO_ACCEPT} multiple onChange={(event) => { setFiles(event.target.files); event.target.value = ""; }} />
              </label>
              <span className="text-xs text-muted-foreground">{entries.length} foto(s) · {count} ímã(s)</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="block text-xs text-muted-foreground">Fonte<select value={textStyle.font} onChange={(event) => setTextStyle((current) => ({ ...current, font: event.target.value }))} className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-foreground"><option>Arial</option><option>Georgia</option><option>Courier New</option><option>cursive</option></select></label>
              <label className="block text-xs text-muted-foreground">Cor da escrita<input type="color" value={textStyle.color} onChange={(event) => setTextStyle((current) => ({ ...current, color: event.target.value }))} className="mt-1 block h-9 w-full rounded-lg border border-input bg-background p-1" /></label>
              <label className="block text-xs text-muted-foreground">Alinhamento<select value={textStyle.align} onChange={(event) => setTextStyle((current) => ({ ...current, align: event.target.value }))} className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-foreground"><option value="left">Esquerda</option><option value="center">Centralizado</option><option value="right">Direita</option></select></label>
              <label className="flex items-center gap-2 pt-5 text-xs text-muted-foreground"><input type="checkbox" checked={textStyle.bold} onChange={(event) => setTextStyle((current) => ({ ...current, bold: event.target.checked }))} /> Negrito</label>
            </div>
            {entries.length > 0 && <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry, index) => <article key={`${entry.name}-${index}`} className="rounded-xl border border-border p-3">
                <div className={`relative mx-auto flex h-40 max-w-[150px] flex-col bg-white p-2 shadow-sm ${style === "polaroid" ? "pb-7" : ""}`}><img src={entry.preview} alt={entry.name} className="min-h-0 flex-1 object-cover" />{entry.caption && <span className={`truncate text-center text-[9px] ${style === "polaroid" ? "" : "absolute inset-x-2 bottom-2 bg-white/90 px-1 py-0.5"}`} style={{ color: textStyle.color, fontFamily: textStyle.font, fontWeight: textStyle.bold ? 700 : 400 }}>{entry.caption}</span>}</div>
                <p className="mt-2 truncate text-xs font-medium">{entry.name}</p>
                <input value={entry.caption} maxLength={60} onChange={(event) => updateEntry(index, { caption: event.target.value })} className="mt-2 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs" placeholder="Escreva uma legenda (opcional)" />
                <div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => updateEntry(index, { copies: Math.max(1, entry.copies - 1) })}><Minus className="h-3 w-3" /></Button><span className="min-w-6 text-center text-xs">{entry.copies}</span><Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => updateEntry(index, { copies: Math.min(50, entry.copies + 1) })}><Plus className="h-3 w-3" /></Button></div><button type="button" onClick={() => removeEntry(index)} aria-label="Remover foto" className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></div>
              </article>)}
            </div>}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm">{count} unidades · <strong className="font-display text-2xl">{formatBRL(total)}</strong>{priceMap[product.id]?.tier?.label ? <span className="ml-2 text-xs text-muted-foreground">Faixa {priceMap[product.id].tier.label}</span> : null}</p>
              <Button className="rounded-full" onClick={addSingle} disabled={busy || !entries.length || perUnit <= 0}><ShoppingBag className="mr-2 h-4 w-4" />Adicionar ao carrinho</Button>
            </div>
            {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
          </section>}
        </div>

        <aside className="h-fit rounded-2xl border border-gold/40 bg-card p-5 lg:sticky lg:top-24">
          <p className="eyebrow">Seu pedido</p>
          <h2 className="mt-2 font-display text-2xl">Imãs personalizados</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">As imagens de impressão são preparadas no tamanho do formato escolhido, com a legenda e o estilo selecionados. Revise a prévia e os textos antes de adicionar ao carrinho.</p>
          <div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
            <p>Kit de tirinhas: preço fixo por kit com três unidades.</p>
            <p className="mt-2">Ímãs individuais: o valor por unidade acompanha a faixa de quantidade configurada pela loja.</p>
          </div>
          {!isAuthenticated && <Button className="mt-5 w-full rounded-full" variant="outline" onClick={() => navigateToLogin()}>Entrar para personalizar</Button>}
        </aside>
      </section>
    </div>
  );
}
