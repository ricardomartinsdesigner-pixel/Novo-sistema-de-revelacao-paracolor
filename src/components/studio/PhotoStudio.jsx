import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpDown, CheckCheck, GripVertical, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BulkSheet from "@/components/studio/BulkSheet";
import CropEditor from "@/components/studio/CropEditor";
import DraftNotice from "@/components/studio/DraftNotice";
import PhotoCard from "@/components/studio/PhotoCard";
import PhotoFilters from "@/components/studio/PhotoFilters";
import PhotoGrid from "@/components/studio/PhotoGrid";
import PhotoOrderDialog from "@/components/studio/PhotoOrderDialog";
import PhotoPreviewDialog from "@/components/studio/PhotoPreviewDialog";
import PhotoReview from "@/components/studio/PhotoReview";
import TierBanner from "@/components/studio/TierBanner";
import StudioActionBar from "@/components/studio/StudioActionBar";
import UploadDropzone from "@/components/studio/UploadDropzone";
import UploadTips from "@/components/studio/UploadTips";
import { useCart } from "@/lib/cart";
import { useEntityList, useSettings } from "@/lib/store";
import { deadlineFor, formatReadyDate, formatDeadlineDuration } from "@/lib/deadline";
import {
  analyzeImage,
  autoCorrect,
  canvasFromPhoto,
  canvasToBlob,
  clampPhoto,
  evaluatePhoto,
  loadImage,
  sizePrintInfo,
} from "@/lib/photo";
import { polaroidGeometry } from "@/lib/polaroid";
import { photoCategory, photoCounts, pricingContext } from "@/lib/quantity-pricing";
import { useQuantityPricing } from "@/hooks/use-quantity-pricing";
import { uid } from "@/lib/uid";
import { clearAdjustments, readAdjustments, saveAdjustments } from "@/lib/studio-draft";
import { isHeicFile, isPdfFile, prepareUploads } from "@/lib/upload-formats";

const MAX_PHOTOS = 1000;
const PAGE_SIZE = 60;

// Mensagem real do envio: o limite mensal do provedor de armazenamento é a causa
// mais comum e precisa aparecer no cartão, em vez de "arquivo não suportado".
function uploadErrorMessage(error) {
  const message = String(error?.message || "");
  if (/limit of integrations|upgrade your plan|quota/i.test(message)) {
    return "Limite mensal de envios atingido. Fale com a loja para liberar.";
  }
  return "O envio falhou. Confira sua internet e use “Tentar novamente”.";
}

function sizeMetrics(size, mode) {
  const { widthCm, heightCm, dpi } = sizePrintInfo(size);
  if (mode === "polaroid") {
    const geo = polaroidGeometry(size);
    return { aspect: 1, printW: geo.side, printH: geo.side, dpi };
  }
  return { aspect: widthCm / heightCm, printW: widthCm, printH: heightCm, dpi };
}

export default function PhotoStudio({ mode = "revelacao" }) {
  const isPolaroid = mode === "polaroid";
  const entity = isPolaroid ? "PolaroidModel" : "PhotoSize";
  const { data: sizes = [], isLoading } = useEntityList(entity, { active: true }, { sort: "sort" });
  const { settings } = useSettings();
  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [ordering, setOrdering] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState("comfortable");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [savedDraft, setSavedDraft] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const pendingRef = useRef(new Map());
  const signatureRef = useRef(new Set());
  const [busy, setBusy] = useState("");
  const [confirmedReview, setConfirmedReview] = useState(false);
  const [bulk, setBulk] = useState({ sizeId: "", fit: "cover", border: false, copies: 1 });
  const { addItems } = useCart();
  const navigate = useNavigate();
  const quantityPricing = useQuantityPricing();
  const tierLines = useMemo(
    () => photos.map((photo) => ({ area: mode, sizeId: photo.sizeId, copies: photo.copies || 1 })),
    [photos, mode]
  );
  const tierMap = useMemo(
    () => pricingContext({ ...quantityPricing.data, counts: photoCounts(tierLines) })[photoCategory(mode)] || {},
    [tierLines, quantityPricing.data, mode]
  );
  const unitPriceFor = (photo) => tierMap[photo.sizeId]?.unit ?? photo.price ?? 0;
  // Quantidade total do pedido e formatos usados: base da faixa de desconto.
  const tierCount = tierLines.reduce((sum, line) => sum + Math.max(1, Number(line.copies) || 1), 0);
  const tierSizeIds = [...new Set(tierLines.map((line) => line.sizeId).filter(Boolean))];

  const defaultSize = sizes[0];
  const activeBulkSize = bulk.sizeId || defaultSize?.id || "";

  const cutPhotos = useMemo(
    () => photos.filter((photo) => (photo.alerts || []).some((alert) => alert.includes("cortado"))),
    [photos]
  );
  const lowResPhotos = useMemo(
    () => photos.filter((photo) => (photo.alerts || []).some((alert) => alert.startsWith("resolucao"))),
    [photos]
  );
  const errorCount = photos.filter((photo) => photo.status === "error").length;
  const problemPhotos = useMemo(() => {
    const ids = new Set([...cutPhotos, ...lowResPhotos].map((photo) => photo.id));
    return photos.filter((photo) => ids.has(photo.id));
  }, [photos, cutPhotos, lowResPhotos]);

  const filteredPhotos = useMemo(() => {
    const term = search.trim().toLowerCase();
    return photos.filter((photo) => {
      if (term && !String(photo.name || "").toLowerCase().includes(term)) return false;
      if (filter === "alerts") return (photo.alerts || []).some((alert) => alert.includes("cortado"));
      if (filter === "lowres") return (photo.alerts || []).some((alert) => alert.startsWith("resolucao"));
      if (filter === "errors") return photo.status === "error";
      return true;
    });
  }, [photos, filter, search]);

  const visiblePhotos = filteredPhotos.slice(0, visibleCount);
  // Arrastar só faz sentido na lista completa: com filtro ativo a posição final seria ambígua.
  const canDrag = filter === "all" && !search.trim();

  // Selecionar/desmarcar todas as fotos da lista visível (respeita filtro e busca).
  const allSelected =
    filteredPhotos.length > 0 && filteredPhotos.every((photo) => selected.includes(photo.id));
  const toggleSelectAll = () => {
    const ids = filteredPhotos.map((photo) => photo.id);
    setSelected((current) =>
      allSelected
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])]
    );
  };

  const readyPhotos = photos.filter((photo) => photo.status === "ready");
  const totalPrice = readyPhotos.reduce(
    (sum, photo) => sum + (unitPriceFor(photo) + (photo.border ? photo.borderPrice || 0 : 0)) * (photo.copies || 1),
    0
  );
  const totalPrints = readyPhotos.reduce((sum, photo) => sum + (photo.copies || 1), 0);
  const needsConfirmation = problemPhotos.length > 0;

  const productionLabel = settings ? formatDeadlineDuration(settings, mode) : "";
  const readyLabel = settings ? formatReadyDate(deadlineFor(settings, mode)) : "";

  function applySize(photo, size) {
    const metrics = sizeMetrics(size, mode);
    const dims = sizePrintInfo(size);
    const next = {
      ...photo,
      sizeId: size.id,
      sizeLabel: size.name,
      wCm: dims.widthCm,
      hCm: dims.heightCm,
      price: size.price,
      borderPrice: size.border_price || 0,
      polaroidModel: isPolaroid ? size.id : photo.polaroidModel,
      ...metrics,
    };
    return { ...next, ...evaluatePhoto(next) };
  }

  async function processOne(entry) {
    const { id, file, preview, kind } = entry;
    // PDF entra como arte pronta: só é enviado, sem prévia nem análise.
    if (kind === "pdf") {
      try {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        setPhotos((current) =>
          current.map((photo) =>
            photo.id === id ? { ...photo, status: "ready", file_uri, kind: "pdf", qualityLabel: "PDF" } : photo
          )
        );
        pendingRef.current.delete(id);
        return true;
      } catch (error) {
        setPhotos((current) =>
          current.map((photo) =>
            photo.id === id
              ? { ...photo, status: "error", error: uploadErrorMessage(error) }
              : photo
          )
        );
        return false;
      }
    }
    let image;
    try {
      image = await loadImage(preview);
    } catch {
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === id
            ? { ...photo, status: "error", error: "Não conseguimos abrir este arquivo. Envie em JPG, PNG, WEBP, AVIF, HEIC ou PDF." }
            : photo
        )
      );
      return false;
    }
    // A medida real da imagem entra antes do envio: miniatura e enquadramento já
    // saem na proporção certa mesmo quando o armazenamento recusa o arquivo.
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === id ? { ...photo, w: image.naturalWidth, h: image.naturalHeight } : photo
      )
    );
    let file_uri = "";
    try {
      ({ file_uri } = await base44.integrations.Core.UploadPrivateFile({ file }));
    } catch (error) {
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === id
            ? { ...photo, status: "error", error: uploadErrorMessage(error) }
            : photo
        )
      );
      return false;
    }
    const analysis = await analyzeImage(image).catch(() => null);
    setPhotos((current) =>
      current.map((photo) => {
        if (photo.id !== id) return photo;
        const next = { ...photo, status: "ready", file_uri, w: image.naturalWidth, h: image.naturalHeight, analysis };
        const evaluation = evaluatePhoto(next);
        return {
          ...next,
          ...evaluation,
          qualityLabel:
            evaluation.quality === "excelente"
              ? "Excelente"
              : evaluation.quality === "adequada"
                ? "Adequada"
                : evaluation.quality === "baixa"
                  ? "Baixa"
                  : "Insuficiente",
        };
      })
    );
    pendingRef.current.delete(id);
    return true;
  }

  async function runQueue(entries) {
    setUploading(true);
    setProgress({ total: entries.length, done: 0 });
    let cursor = 0;
    let failures = 0;
    const worker = async () => {
      while (cursor < entries.length) {
        const entry = entries[cursor];
        cursor += 1;
        const ok = await processOne(entry);
        if (!ok) failures += 1;
        setProgress((current) => (current ? { ...current, done: current.done + 1 } : current));
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker));
    setUploading(false);
    setProgress(null);
    return failures;
  }

  async function handleFiles(input) {
    if (!defaultSize) {
      toast.error("Nenhum formato cadastrado ainda. Avise a loja para configurar os tamanhos.");
      return;
    }
    const heicCount = input.filter(isHeicFile).length;
    if (heicCount) toast.info(`Convertendo ${heicCount} foto(s) do iPhone…`);
    const { files, heicFailed } = await prepareUploads(input);
    if (heicFailed) toast.warning(`${heicFailed} foto(s) HEIC não puderam ser convertidas. Envie essas em JPG.`);
    if (!files.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`Este envio já tem ${MAX_PHOTOS} fotos. Finalize este pedido para enviar mais.`);
      return;
    }

    const entries = [];
    let duplicated = 0;
    let overflow = 0;
    for (const file of files) {
      const signature = `${file.name}|${file.size}|${file.lastModified}`;
      if (signatureRef.current.has(signature)) {
        duplicated += 1;
        continue;
      }
      if (entries.length >= room) {
        overflow += 1;
        continue;
      }
      signatureRef.current.add(signature);
      entries.push({ id: uid(), file, signature, preview: URL.createObjectURL(file) });
    }

    if (duplicated) toast.info(`${duplicated} foto(s) repetida(s) foram ignoradas.`);
    if (overflow) toast.warning(`${overflow} foto(s) ficaram de fora: o limite é ${MAX_PHOTOS} por envio.`);
    if (!entries.length) return;

    const saved = readAdjustments(mode);
    let restored = 0;
    const prepared = entries.map((entry) => {
      pendingRef.current.set(entry.id, entry.file);
      const base = applySize(
        {
          id: entry.id,
          name: entry.file.name,
          signature: entry.signature,
          preview: entry.preview,
          status: "uploading",
          fit: "cover",
          border: false,
          zoom: 1,
          ox: 0,
          oy: 0,
          rotation: 0,
          flipH: false,
          flipV: false,
          copies: 1,
          caption: "",
          captionStyle: { font: "hand", size: 0.062, color: "#1A1614", align: "center" },
          area: mode,
          kind: isPdfFile(entry.file) ? "pdf" : "image",
          alerts: [],
          quality: "adequada",
        },
        defaultSize
      );
      const previous = saved[entry.signature];
      if (!previous) return base;
      const keepsSize = sizes.some((item) => item.id === previous.sizeId);
      restored += 1;
      const merged = keepsSize
        ? { ...base, ...previous }
        : {
            ...base,
            ...previous,
            sizeId: base.sizeId,
            sizeLabel: base.sizeLabel,
            wCm: base.wCm,
            hCm: base.hCm,
            price: base.price,
            borderPrice: base.borderPrice,
            polaroidModel: base.polaroidModel,
            aspect: base.aspect,
            printW: base.printW,
            printH: base.printH,
            dpi: base.dpi,
          };
      return {
        ...merged,
        id: entry.id,
        name: entry.file.name,
        signature: entry.signature,
        preview: entry.preview,
        status: "uploading",
        alerts: [],
        ...evaluatePhoto(merged),
      };
    });
    if (restored) toast.info(`Ajustes anteriores restaurados em ${restored} foto(s).`);
    const pdfCount = prepared.filter((photo) => photo.kind === "pdf").length;
    if (pdfCount)
      toast.info(`${pdfCount} PDF(s) serão impressos exatamente como enviados, sem ajuste de enquadramento.`);
    setPhotos((current) => [...current, ...prepared]);

    const failures = await runQueue(entries);
    if (failures) toast.warning(`${failures} foto(s) não puderam ser lidas. Use "Tentar novamente".`);
  }

  async function retryErrors() {
    const entries = photos
      .filter((photo) => photo.status === "error" && pendingRef.current.has(photo.id))
      .map((entry) => ({ id: entry.id, file: pendingRef.current.get(entry.id), preview: entry.preview, kind: entry.kind }));
    if (!entries.length) return;
    const ids = new Set(entries.map((entry) => entry.id));
    setPhotos((current) =>
      current.map((photo) => (ids.has(photo.id) ? { ...photo, status: "uploading", error: "" } : photo))
    );
    const failures = await runQueue(entries);
    if (failures) toast.warning(`${failures} foto(s) continuam com erro.`);
  }

  function updatePhotos(ids, patchFn) {
    const set = new Set(ids);
    setPhotos((current) => current.map((photo) => (set.has(photo.id) ? patchFn(photo) : photo)));
  }

  function deletePhotos(ids) {
    const set = new Set(ids);
    const removed = photos.filter((photo) => set.has(photo.id));
    removed.forEach((photo) => {
      if (photo.signature) signatureRef.current.delete(photo.signature);
      if (String(photo.preview || "").startsWith("blob:")) URL.revokeObjectURL(photo.preview);
    });
    setPhotos((current) => current.filter((photo) => !set.has(photo.id)));
    setSelected((current) => current.filter((id) => !set.has(id)));
    if (removed.length) {
      toast(`${removed.length} foto(s) removida(s)`, {
        action: {
          label: "Desfazer",
          onClick: () => setPhotos((current) => [...current, ...removed]),
        },
      });
    }
  }

  function duplicatePhotos(ids) {
    const set = new Set(ids);
    const copies = photos
      .filter((photo) => set.has(photo.id))
      .map((photo) => ({ ...photo, id: uid(), name: `${photo.name} (cópia)` }));
    setPhotos((current) => [...current, ...copies]);
  }

  // Arrastar na própria grade: a ordem vira a ordem de impressão e dos arquivos.
  function reorderPhotos(from, to) {
    setPhotos((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function fixAllCuts() {
    if (!cutPhotos.length) return;
    const ids = new Set(cutPhotos.map((photo) => photo.id));
    setPhotos((current) =>
      current.map((photo) => {
        if (!ids.has(photo.id) || photo.kind === "pdf") return photo;
        const next = autoCorrect({ ...photo });
        return { ...next, ...evaluatePhoto(next) };
      })
    );
    toast.success(`${cutPhotos.length} foto(s) reenquadradas automaticamente.`);
  }

  function applyCropToAll(updated) {
    let count = 0;
    setPhotos((current) =>
      current.map((photo) => {
        if (photo.id === updated.id || photo.kind === "pdf") return photo;
        count += 1;
        const next = clampPhoto({
          ...photo,
          fit: updated.fit,
          zoom: updated.zoom,
          ox: updated.ox,
          oy: updated.oy,
          rotation: updated.rotation,
          flipH: updated.flipH,
          flipV: updated.flipV,
        });
        return { ...next, ...evaluatePhoto(next) };
      })
    );
    if (count) toast.success(`Enquadramento aplicado em ${count} outra(s) foto(s).`);
  }

  function clearAll() {
    photos.forEach((photo) => {
      if (String(photo.preview || "").startsWith("blob:")) URL.revokeObjectURL(photo.preview);
    });
    setPhotos([]);
    setSelected([]);
    signatureRef.current.clear();
    pendingRef.current.clear();
    clearAdjustments(mode);
    setSavedDraft(0);
    setConfirmClear(false);
  }

  function clearDraft() {
    clearAdjustments(mode);
    setSavedDraft(0);
    toast("Ajustes salvos apagados.");
  }

  // A barra de ajustes aplica na hora o que é escolhido: cada miniatura já mostra
  // o formato, o modelo de polaroide e o enquadramento finais.
  function bulkTargets() {
    return selected.length ? selected : photos.map((photo) => photo.id);
  }

  function bulkSize(sizeId) {
    const size = sizes.find((item) => item.id === sizeId);
    if (!size) return;
    setBulk((current) => ({ ...current, sizeId }));
    updatePhotos(bulkTargets(), (photo) => applySize(photo, size));
  }

  function bulkPatch(patch) {
    setBulk((current) => ({ ...current, ...patch }));
    updatePhotos(bulkTargets(), (photo) => ({
      ...photo,
      ...patch,
      ...(patch.fit === "contain" ? { ox: 0, oy: 0 } : {}),
    }));
  }

  async function addToCart() {
    if (!readyPhotos.length) return;
    if (needsConfirmation && !confirmedReview) {
      toast.error("Confirme que revisou os avisos antes de continuar.");
      return;
    }
    setBusy("Preparando arquivos de impressão…");
    try {
      const prepared = [];
      for (let index = 0; index < readyPhotos.length; index += 1) {
        const photo = readyPhotos[index];
        setBusy(`Preparando arquivo ${index + 1} de ${readyPhotos.length}…`);
        // O PDF já é o arquivo final de impressão: vai para a produção como enviado.
        let printUri = photo.file_uri;
        let printName = photo.name;
        if (photo.kind !== "pdf") {
          const image = await loadImage(photo.preview);
          const model = isPolaroid ? sizes.find((size) => size.id === photo.sizeId) : null;
          const canvas = await canvasFromPhoto({ ...photo, area: mode }, image, model);
          const blob = await canvasToBlob(canvas);
          const safeName = String(photo.name || "foto").replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "_").slice(0, 40) || "foto";
          const safeSize = String(photo.sizeLabel || "impressao").replace(/\W+/g, "");
          const file = new File([blob], `${safeName}_${safeSize}_impressao.jpg`, {
            type: "image/jpeg",
          });
          ({ file_uri: printUri } = await base44.integrations.Core.UploadPrivateFile({ file }));
          printName = file.name;
        }
        prepared.push({
          filename: photo.name,
          original_file_uri: photo.file_uri,
          print_file_uri: printUri,
          print_name: printName,
          size_name: photo.sizeLabel,
          width_cm: photo.wCm,
          height_cm: photo.hCm,
          fit_mode: photo.kind === "pdf" ? "original" : photo.fit,
          border: photo.border,
          zoom: photo.zoom,
          offset_x: photo.ox,
          offset_y: photo.oy,
          rotation: photo.rotation,
          flip_h: photo.flipH,
          flip_v: photo.flipV,
          quality: photo.quality,
          alerts: photo.alerts,
          caption: photo.caption || "",
          caption_style: photo.captionStyle || {},
          polaroid_model: isPolaroid ? photo.sizeLabel : "",
          copies: photo.copies || 1,
          confirmed_issue: confirmedReview || (photo.confirmed || []).length > 0,
          preview: photo.preview,
        });
      }

      const groups = new Map();
      prepared.forEach((photo) => {
        const key = photo.size_name;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(photo);
      });

      const items = Array.from(groups.entries()).map(([sizeName, group]) => {
        const size = sizes.find((item) => item.name === sizeName);
        const tier = tierMap[size?.id];
        const unit = Number(tier?.unit ?? size?.price ?? 0);
        const borderPrice = Number(size?.border_price) || 0;
        const total = group.reduce(
          (sum, photo) => sum + (unit + (photo.border ? borderPrice : 0)) * Math.max(1, photo.copies || 1),
          0
        );
        return {
          key: uid(),
          area: mode,
          ref_id: size?.id,
          title: `${isPolaroid ? "Polaroid" : "Revelação"} ${sizeName}`,
          subtitle: `${group.length} foto(s)`,
          borderPrice,
          tierLabel: tier?.tier?.label || "",
          unitPrice: Math.round(total * 100) / 100,
          qty: 1,
          photos: group,
          image: group[0]?.preview,
        };
      });

      addItems(items);
      toast.success("Fotos adicionadas ao carrinho");
      navigate({ to: "/carrinho" });
    } catch (error) {
      toast.error(error?.message || "Não foi possível preparar os arquivos. Tente novamente.");
    } finally {
      setBusy("");
    }
  }

  const editingPhoto = photos.find((photo) => photo.id === editingId && photo.kind !== "pdf");
  const previewPhoto = photos.find((photo) => photo.id === previewId && photo.kind !== "pdf");

  useEffect(() => {
    if (!photos.length) return undefined;
    const timer = setTimeout(() => saveAdjustments(mode, photos), 600);
    return () => clearTimeout(timer);
  }, [photos, mode]);

  // Recontagem ao esvaziar a lista: excluindo as fotos uma a uma, o aviso de
  // ajustes salvos volta a aparecer como no primeiro acesso.
  useEffect(() => {
    if (photos.length) return;
    setSavedDraft(Object.keys(readAdjustments(mode)).length);
  }, [mode, photos.length]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, search]);

  if (isLoading) {
    return <div className="container-x py-24 text-center text-sm text-muted-foreground">Carregando formatos…</div>;
  }

  return (
    <div className={`container-x pt-10 ${photos.length ? "pb-36" : "pb-10"}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{isPolaroid ? "Estúdio de polaroids" : "Estúdio de revelação"}</p>
          <h1 className="mt-2 text-4xl leading-tight">
            {isPolaroid ? "Crie suas polaroids" : "Revele suas fotos"}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {isPolaroid
              ? "Escolha o modelo de moldura, ajuste o enquadramento e escreva a legenda direto na prévia."
              : "Envie as fotos, escolha o formato e ajuste o que entra na impressão. Você vê o corte antes de comprar."}
          </p>
        </div>
        {photos.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Limpar tudo
          </Button>
        )}
      </div>

      <div className="mt-8">
        <UploadDropzone onFiles={handleFiles} uploading={uploading} />
      </div>

      {photos.length === 0 ? (
        <>
          <UploadTips />
          <DraftNotice count={savedDraft} onClear={clearDraft} />
        </>
      ) : null}

      {progress ? (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Enviando {progress.done} de {progress.total}…
            </span>
            <span>{Math.round((progress.done / progress.total) * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {photos.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Nenhuma foto ainda. Envie a primeira para começar.
        </p>
      ) : (
        <>
          <PhotoFilters
            value={filter}
            onChange={setFilter}
            search={search}
            onSearch={setSearch}
            density={density}
            onDensity={setDensity}
            counts={{ all: photos.length, alerts: cutPhotos.length, lowres: lowResPhotos.length, errors: errorCount }}
            cutCount={cutPhotos.length}
            onFixCuts={fixAllCuts}
          />

          <TierBanner
            area={mode}
            count={tierCount}
            sizeIds={tierSizeIds}
            sizes={sizes}
            tiers={quantityPricing.data.tiers}
            tierPrices={quantityPricing.data.tierPrices}
          />

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">
              {readyPhotos.length} pronta(s) · {photos.length} enviada(s)
            </span>
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustes em lote
            </button>
            <button
              type="button"
              onClick={() => setOrdering(true)}
              className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
            >
              <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar em lista
            </button>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1 rounded-full border border-gold/60 bg-gold-soft/40 px-2.5 py-1 font-medium text-foreground underline-offset-4 hover:border-gold hover:bg-gold-soft hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {allSelected
                ? "Desmarcar todas"
                : `Selecionar todas${filteredPhotos.length !== photos.length ? " do filtro" : ""}`}
            </button>
            {selected.length ? (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                <X className="h-3.5 w-3.5" /> Limpar seleção ({selected.length})
              </button>
            ) : null}
            {errorCount ? (
              <button
                type="button"
                onClick={retryErrors}
                disabled={uploading}
                className="text-amber-700 underline-offset-4 hover:underline disabled:opacity-50"
              >
                Tentar novamente ({errorCount})
              </button>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <GripVertical className="h-3.5 w-3.5" />
              {canDrag ? "Arraste para reordenar · toque na foto para ampliar" : "Limpe busca e filtro para arrastar"}
            </span>
          </div>

          {filteredPhotos.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhuma foto neste filtro.
            </p>
          ) : (
            <div className="mt-4">
              <PhotoGrid
                photos={visiblePhotos}
                density={density}
                canDrag={canDrag}
                onReorder={reorderPhotos}
                renderCard={(photo, index, dragHandleProps, isDragging) => (
                  <PhotoCard
                    photo={photo}
                    index={index}
                    compact={density === "compact"}
                    isDragging={isDragging}
                    dragHandleProps={dragHandleProps}
                    model={isPolaroid ? sizes.find((size) => size.id === photo.sizeId) : null}
                    sizes={sizes}
                    selected={selected.includes(photo.id)}
                    onToggle={(id) =>
                      setSelected((current) =>
                        current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
                      )
                    }
                    onSizeChange={(id, sizeId) => {
                      const size = sizes.find((item) => item.id === sizeId);
                      if (size) updatePhotos([id], (item) => applySize(item, size));
                    }}
                    onEdit={(id) => {
                      setPreviewId(null);
                      setEditingId(id);
                    }}
                    onPreview={setPreviewId}
                    onDelete={(id) => {
                      setPreviewId(null);
                      deletePhotos([id]);
                    }}
                    onDuplicate={(id) => {
                      setPreviewId(null);
                      duplicatePhotos([id]);
                    }}
                  />
                )}
              />
            </div>
          )}

          {filteredPhotos.length > visiblePhotos.length ? (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                className="rounded-full"
              >
                Ver mais fotos
              </Button>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Mostrando {visiblePhotos.length} de {filteredPhotos.length}
              </p>
            </div>
          ) : null}

          <PhotoReview
            readyCount={readyPhotos.length}
            printCount={totalPrints}
            problemPhotos={problemPhotos}
            needsConfirmation={needsConfirmation}
            confirmed={confirmedReview}
            onConfirmedChange={setConfirmedReview}
            onEdit={setEditingId}
            onUseWhole={(id) => updatePhotos([id], (item) => ({ ...item, fit: "contain", ox: 0, oy: 0 }))}
            total={totalPrice}
            busy={Boolean(busy)}
            onAdd={addToCart}
            tierArea={mode}
            tierLines={tierLines}
            tierGroups={quantityPricing.data.groups}
            tierTiers={quantityPricing.data.tiers}
            productionLabel={productionLabel}
            readyLabel={readyLabel}
          />
        </>
      )}

      {editingPhoto && (
        <CropEditor
          photo={editingPhoto}
          sizes={sizes}
          mode={mode}
          onClose={() => setEditingId(null)}
          onSave={(updated, options) => {
            setPhotos((current) =>
              current.map((photo) => {
                if (photo.id === updated.id) return updated;
                if (options?.applyCaptionAll && photo.area === "polaroid") {
                  return { ...photo, caption: updated.caption || "", captionStyle: updated.captionStyle || {} };
                }
                return photo;
              })
            );
            if (options?.applyCropAll) applyCropToAll(updated);
            if (options?.applyCaptionAll) {
              const others = photos.filter((photo) => photo.id !== updated.id && photo.area === "polaroid").length;
              toast.success(
                others ? `Escrita aplicada em ${others + 1} polaroide(s)` : "Escrita salva nesta polaroide"
              );
            }
            setEditingId(null);
          }}
        />
      )}

      {previewPhoto && (
        <PhotoPreviewDialog
          photo={previewPhoto}
          model={isPolaroid ? sizes.find((size) => size.id === previewPhoto.sizeId) : null}
          onClose={() => setPreviewId(null)}
          onEdit={(id) => {
            setPreviewId(null);
            setEditingId(id);
          }}
          onDelete={(id) => {
            setPreviewId(null);
            deletePhotos([id]);
          }}
          onDuplicate={(id) => {
            setPreviewId(null);
            duplicatePhotos([id]);
          }}
        />
      )}

      {ordering && (
        <PhotoOrderDialog
          photos={photos}
          onClose={() => setOrdering(false)}
          onSave={(ids) => {
            const order = new Map(ids.map((id, index) => [id, index]));
            setPhotos((current) => [...current].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
            setOrdering(false);
            toast.success("Ordem das fotos atualizada");
          }}
        />
      )}

      <BulkSheet
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        sizes={sizes}
        selectedCount={selected.length}
        totalCount={photos.length}
        sizeId={activeBulkSize}
        onSizeChange={bulkSize}
        fit={bulk.fit}
        onFitChange={(fit) => bulkPatch({ fit })}
        border={bulk.border}
        onBorderChange={(border) => bulkPatch({ border })}
        showBorder={!isPolaroid}
        copies={bulk.copies}
        onCopiesChange={(copies) => bulkPatch({ copies })}
        onDeleteSelected={() => deletePhotos(selected)}
        onDuplicateSelected={() => duplicatePhotos(selected)}
        onSelectAll={() => setSelected(selected.length === photos.length ? [] : photos.map((photo) => photo.id))}
        onInvert={() => setSelected(photos.map((photo) => photo.id).filter((id) => !selected.includes(id)))}
        onClearSelection={() => setSelected([])}
      />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir todas as fotos do envio?</AlertDialogTitle>
            <AlertDialogDescription>
              As {photos.length} foto(s) saem da lista junto com os ajustes de enquadramento, formato e legenda.
              Você poderá enviar novamente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter fotos</AlertDialogCancel>
            <AlertDialogAction onClick={clearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StudioActionBar
        photoCount={readyPhotos.length}
        total={totalPrice}
        alertCount={problemPhotos.length}
        selectedCount={selected.length}
        busy={Boolean(busy) || uploading}
        onAdd={addToCart}
        onOpenBulk={() => setBulkOpen(true)}
      />
    </div>
  );
}
