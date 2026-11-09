import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpDown, CheckCheck, GripVertical, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import PhotoDuplicateReview from "@/components/tools/PhotoDuplicateReview";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/cart";
import { moduleEnabled, useEntityList, useSettings } from "@/lib/store";
import { deadlineFor, formatReadyDate, formatDeadlineDuration } from "@/lib/deadline";
import {
  analyzeImage,
  autoCorrect,
  canvasFromPhoto,
  canvasFromPhoto34Sheet,
  canvasToBlob,
  clampPhoto,
  evaluatePhoto,
  loadImage,
  photoSizeMetrics,
} from "@/lib/photo";
import { linesFromItems, photoCategory, photoCounts, pricingContext } from "@/lib/quantity-pricing";
import { useQuantityPricing } from "@/hooks/use-quantity-pricing";
import { uid } from "@/lib/uid";
import { clearAdjustments, draftFileId, readAdjustments, readUploadDraft, saveAdjustments, saveUploadDraft } from "@/lib/studio-draft";
import { isHeicFile, isPdfFile, prepareUploads } from "@/lib/upload-formats";
import { analyzePhotoDuplicates } from "@/lib/photo-duplicates";
import { consumePendingPhotoImport } from "@/lib/pending-photo-import";
import { photoColorEffect } from "@/lib/photo-color-effects";
import { MAX_ORDER_PHOTOS, movePhoto } from "@/lib/photo-order";

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

export default function PhotoStudio({ mode = "revelacao" }) {
  const isPolaroid = mode === "polaroid";
  const entity = isPolaroid ? "PolaroidModel" : "PhotoSize";
  const { data: sizes = [], isLoading } = useEntityList(entity, { active: true }, { sort: "sort" });
  const { settings } = useSettings();
  const { user } = useAuth();
  const userId = user?.id;
  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState([]);
  const [editor, setEditor] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [ordering, setOrdering] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState("comfortable");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [savedDraft, setSavedDraft] = useState(0);
  const [savedUpload, setSavedUpload] = useState([]);
  const draftActiveRef = useRef(false);
  const draftPhotosRef = useRef([]);
  const preparedRef = useRef(new Map());
  const [printFailures, setPrintFailures] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const pendingRef = useRef(new Map());
  const workRef = useRef(false);
  const previewsRef = useRef(new Set());
  const [duplicateReview, setDuplicateReview] = useState(null);
  const pendingImportHandler = useRef(null);
  const [busy, setBusy] = useState("");
  const [sheetPreview, setSheetPreview] = useState(null);
  const [sheetPreviewBusy, setSheetPreviewBusy] = useState(false);
  const [reviewedPhotos, setReviewedPhotos] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const reviewFocusRef = useRef(null);
  const thumbnailAreaRef = useRef(null);
  const confirmedReview = reviewedPhotos === photos;
  const [bulk, setBulk] = useState({ sizeId: "", fit: "cover", border: false, copies: 1 });
  const [allPhotosSizeId, setAllPhotosSizeId] = useState("");
  const { items: cartItems, addItems } = useCart();
  const cartFiles = cartItems.reduce((total, item) => total + (item.photos?.length ?? 0), 0);

  useEffect(() => () => {
    if (sheetPreview?.url) URL.revokeObjectURL(sheetPreview.url);
  }, [sheetPreview]);

  async function openPhoto34SheetPreview() {
    const photo = readyPhotos.find((item) => item.is_photo_3x4 && item.preview);
    if (!photo || sheetPreviewBusy) return;
    setSheetPreviewBusy(true);
    try {
      const image = await loadImage(photo.preview);
      const canvas = await canvasFromPhoto34Sheet({ ...photo, area: mode }, image);
      const blob = await canvasToBlob(canvas);
      const url = URL.createObjectURL(blob);
      canvas.width = 0;
      canvas.height = 0;
      setSheetPreview({ url, name: photo.name });
    } catch {
      toast.error("Não foi possível gerar a prévia da folha 3×4. Confira o arquivo e tente novamente.");
    } finally {
      setSheetPreviewBusy(false);
    }
  }
  const navigate = useNavigate();
  const quantityPricing = useQuantityPricing(!isPolaroid);
  const readyPhotos = useMemo(() => photos.filter((photo) => photo.status === "ready"), [photos]);
  const tierLines = useMemo(
    () => [
      ...linesFromItems(cartItems).filter((line) => line.area === mode),
      ...readyPhotos.filter((photo) => !photo.is_photo_3x4).map((photo) => ({ area: mode, sizeId: photo.sizeId, copies: photo.copies || 1 })),
    ],
    [readyPhotos, cartItems, mode]
  );
  const tierMap = useMemo(
    () => pricingContext({ ...quantityPricing.data, counts: photoCounts(tierLines) })[photoCategory(mode)] || {},
    [tierLines, quantityPricing.data, mode]
  );
  const unitPriceFor = (photo) => photo.is_photo_3x4 ? photo.price ?? 0 : tierMap[photo.sizeId]?.unit ?? photo.price ?? 0;
  const displayPricing = !isPolaroid && quantityPricing.data.professional ? quantityPricing.data.professional : quantityPricing.data;
  const tierSizeIds = [...new Set(readyPhotos.filter((photo) => !photo.is_photo_3x4).map((photo) => photo.sizeId).filter(Boolean))];

  const defaultSize = sizes[0];
  const activeBulkSize = bulk.sizeId || defaultSize?.id || "";
  const activeAllPhotosSize = sizes.some((size) => size.id === allPhotosSizeId)
    ? allPhotosSizeId
    : activeBulkSize;

  const cutPhotos = useMemo(
    () => photos.filter((photo) => (photo.alerts || []).some((alert) => alert.includes("cortado"))),
    [photos]
  );
  const lowResPhotos = useMemo(
    () => photos.filter((photo) => (photo.alerts || []).some((alert) => alert.startsWith("resolucao"))),
    [photos]
  );
  const errorCount = photos.filter((photo) => photo.status === "error").length;
  const retryableCount = photos.filter((photo) => photo.status === "error" && pendingRef.current.has(photo.id)).length;
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

  function openEditor(id, sequenceIds = null) {
    const allowedIds = sequenceIds ? new Set(sequenceIds) : null;
    const editable = readyPhotos.filter((photo) => photo.kind !== "pdf" && (!allowedIds || allowedIds.has(photo.id)));
    if (!editable.some((photo) => photo.id === id)) return;
    const filteredIds = new Set(filteredPhotos.map((photo) => photo.id));
    // A fila da revisão mantém o lugar da foto mesmo se o ajuste resolver seu alerta.
    const sequence = (filteredIds.has(id) ? editable.filter((photo) => filteredIds.has(photo.id)) : editable)
      .map((photo) => photo.id);
    setPreviewId(null);
    setEditor({ id, sequence });
  }
  // Arrastar só faz sentido na lista completa: com filtro ativo a posição final seria ambígua.
  const canDrag = filter === "all" && !search.trim() && !uploading && !busy;

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

  const totalPrice = readyPhotos.reduce(
    (sum, photo) => sum + (unitPriceFor(photo) + (photo.border ? photo.borderPrice || 0 : 0)) * (photo.copies || 1),
    0
  );
  const totalPrints = readyPhotos.reduce((sum, photo) => sum + (photo.copies || 1), 0);
  const needsConfirmation = problemPhotos.length > 0;

  const productionLabel = settings ? formatDeadlineDuration(settings, mode) : "";
  const readyLabel = settings ? formatReadyDate(deadlineFor(settings, mode)) : "";

  function applySize(photo, size) {
    const metrics = photoSizeMetrics(size, mode, photo);
    const next = {
      ...photo,
      sizeId: size.id,
      sizeLabel: size.name,
      price: size.price,
      borderPrice: size.border_price || 0,
      is_photo_3x4: Boolean(size.is_photo_3x4),
      border: size.is_photo_3x4 ? false : photo.border,
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
      pendingRef.current.delete(id);
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
    setPhotos((current) => current.map((photo) => {
      if (photo.id !== id) return photo;
      const withDimensions = { ...photo, w: image.naturalWidth, h: image.naturalHeight };
      const selectedSize = sizes.find((size) => size.id === photo.sizeId) || defaultSize;
      return selectedSize ? applySize(withDimensions, selectedSize) : withDimensions;
    }));
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
    setPhotos((current) => current.map((photo) => photo.id === id ? { ...photo, file_uri } : photo));
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
    const mobileOrLowMemory = typeof navigator !== "undefined" && (
      (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      window.matchMedia?.("(max-width: 720px)").matches
    );
    await Promise.all(Array.from({ length: Math.min(mobileOrLowMemory ? 2 : 4, entries.length) }, worker));
    setProgress(null);
    return failures;
  }

  async function withUpload(task) {
    if (workRef.current) return;
    workRef.current = true;
    setUploading(true);
    try {
      await task();
    } catch (error) {
      toast.error(uploadErrorMessage(error));
    } finally {
      setProgress(null);
      setUploading(false);
      workRef.current = false;
    }
  }

  function handleFiles(input) {
    return withUpload(() => stageFiles(input));
  }

  async function stageFiles(input) {
    if (!defaultSize) {
      toast.error("Nenhum formato cadastrado ainda. Avise a loja para configurar os tamanhos.");
      return;
    }
    const room = Math.max(0, MAX_ORDER_PHOTOS - cartFiles - photos.length);
    const missing = photos.filter((photo) => photo.needsFile);
    if (!room && !missing.length) {
      toast.error(`O pedido já alcançou o limite de ${MAX_ORDER_PHOTOS} fotos.`);
      return;
    }

    const heicCount = input.filter(isHeicFile).length;
    if (heicCount) toast.info(`Convertendo ${heicCount} foto(s) do iPhone…`);
    const { files, heicFailed } = await prepareUploads(input);
    if (heicFailed) toast.warning(`${heicFailed} foto(s) HEIC não puderam ser convertidas. Envie essas em JPG.`);
    if (!files.length) return;
    const runOrganizer = moduleEnabled(settings, "photo_duplicate_organizer");
    let analyzed = files.map((file) => ({ file, contentHash: "", visualHash: "", exactGroup: "", exactMatches: [], similarMatches: [] }));
    if (runOrganizer) {
      setProgress({ done: 0, total: files.length, phase: "analysis" });
      try {
        analyzed = await analyzePhotoDuplicates(
          files,
          photos.filter((photo) => !photo.needsFile),
          (done, total) => setProgress({ done, total, phase: "analysis" }),
        );
      } catch {
        toast.warning("Não foi possível concluir a comparação. As fotos podem ser enviadas mesmo assim.");
      } finally {
        setProgress(null);
      }
    }

    let newCount = 0;
    let overflow = 0;
    const matchedMissing = new Set();
    const entries = analyzed.map((entry) => {
      const signature = `${entry.file.name}|${entry.file.size}|${entry.file.lastModified}`;
      const replacements = missing.filter((photo) => photo.signature === signature && !matchedMissing.has(photo.id));
      replacements.forEach((photo) => matchedMissing.add(photo.id));
      if (!replacements.length) {
        if (newCount >= room) {
          overflow += 1;
          return null;
        }
        newCount += 1;
      }
      return {
        ...entry,
        signature,
        kind: isPdfFile(entry.file) ? "pdf" : "image",
        replacements,
      };
    }).filter(Boolean);
    if (overflow) toast.warning(`${overflow} foto(s) ficaram de fora: o limite é ${MAX_ORDER_PHOTOS} por pedido.`);
    if (!entries.length) return;

    const hasMatches = entries.some((entry) => entry.exactGroup || entry.similarMatches?.length);
    if (runOrganizer && hasMatches) {
      setDuplicateReview(entries);
      return;
    }
    await importPreparedEntries(entries);
  }

  function continueDuplicateReview(entries) {
    setDuplicateReview(null);
    return withUpload(() => importPreparedEntries(entries));
  }

  async function importPreparedEntries(inputEntries) {
    if (!inputEntries.length) return;
    const expandedEntries = inputEntries.flatMap((entry) => {
      if (entry.replacements?.length) return entry.replacements.map((replacement) => ({ ...entry, replacement }));
      return [entry];
    });
    const entries = expandedEntries.map((entry) => {
      const signature = entry.signature || `${entry.file.name}|${entry.file.size}|${entry.file.lastModified}`;
      const kind = entry.kind || (isPdfFile(entry.file) ? "pdf" : "image");
      const id = entry.replacement?.id || uid();
      const preview = kind === "pdf" ? "" : URL.createObjectURL(entry.file);
      if (preview) previewsRef.current.add(preview);
      return { ...entry, id, signature, kind, preview };
    });
    const matched = new Set(entries.filter((entry) => entry.replacement).map((entry) => entry.id));

    const saved = readAdjustments(mode);
    let restored = 0;
    const prepared = entries.map((entry) => {
      pendingRef.current.set(entry.id, entry.file);
      if (entry.replacement) {
        const replacementModel = isPolaroid ? sizes.find((item) => item.id === entry.replacement.sizeId) : null;
        return {
          ...entry.replacement,
          ...(replacementModel ? photoSizeMetrics(replacementModel, mode, entry.replacement) : {}),
          signature: entry.signature,
          contentHash: entry.contentHash,
          visualHash: entry.visualHash,
          preview: entry.preview,
          status: "uploading",
          needsFile: false,
          error: "",
          file_uri: "",
        };
      }
      const base = applySize(
        {
          id: entry.id,
          name: entry.file.name,
          signature: entry.signature,
          contentHash: entry.contentHash,
          visualHash: entry.visualHash,
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
          kind: entry.kind,
          alerts: [],
          quality: "adequada",
        },
        defaultSize
      );
      const previous = saved[entry.signature];
      if (!previous) return base;
      const keepsSize = sizes.some((item) => item.id === previous.sizeId);
      restored += 1;
      let merged = keepsSize
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
      if (isPolaroid && keepsSize) {
        const restoredModel = sizes.find((item) => item.id === merged.sizeId);
        if (restoredModel) merged = applySize(merged, restoredModel);
      }
      return {
        ...merged,
        id: entry.id,
        name: entry.file.name,
        signature: entry.signature,
        contentHash: entry.contentHash,
        visualHash: entry.visualHash,
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
    const replacements = new Map(prepared.filter((photo) => matched.has(photo.id)).map((photo) => [photo.id, photo]));
    draftActiveRef.current = true;
    setPhotos((current) => [
      ...current.map((photo) => replacements.get(photo.id) ?? photo),
      ...prepared.filter((photo) => !matched.has(photo.id)),
    ]);

    const failures = await runQueue(entries);
    if (failures) toast.warning(`${failures} foto(s) não puderam ser lidas. Use "Tentar novamente".`);
  }

  function discardSavedUpload() {
    saveUploadDraft(userId, mode, []);
    setSavedUpload([]);
  }

  function resumeUpload() {
    return withUpload(async () => {
      if (!defaultSize) {
        toast.error("Nenhum formato está disponível para continuar este envio.");
        return;
      }
      const ids = [...new Set(savedUpload.map((photo) => draftFileId(photo.file_uri)).filter(Boolean))];
      const response = await fetch("/api/files/draft", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ids),
      });
      if (!response.ok) throw new Error("Não foi possível conferir os arquivos do envio.");
      const available = new Set(await response.json());
      const restored = savedUpload.map((photo) => {
        const id = draftFileId(photo.file_uri);
        const ready = available.has(id);
        return applySize({
          ...photo,
          status: ready ? "ready" : "error",
          needsFile: !ready,
          file_uri: ready ? photo.file_uri : "",
          preview: ready && photo.kind !== "pdf" ? `/api/files/${id}?draft=1` : "",
          error: ready ? "" : "Selecione novamente este mesmo arquivo para completar o envio.",
        }, sizes.find((size) => size.id === photo.sizeId) || defaultSize);
      });
      draftActiveRef.current = true;
      setPhotos(restored);
      setSavedUpload([]);
    });
  }

  function retryErrors() {
    return withUpload(retryFailedPhotos);
  }

  async function retryFailedPhotos() {
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
    });
    setPhotos((current) => current.filter((photo) => !set.has(photo.id)));
    setSelected((current) => current.filter((id) => !set.has(id)));
    if (removed.length) {
      toast(`${removed.length} foto(s) removida(s)`, {
        action: {
          label: "Desfazer",
          onClick: () => {
            setPhotos((current) => [...current, ...removed]);
          },
        },
      });
    }
  }

  function duplicatePhotos(ids) {
    const set = new Set(ids);
    const room = Math.max(0, MAX_ORDER_PHOTOS - cartFiles - photos.length);
    const candidates = photos.filter((photo) => set.has(photo.id) && photo.status === "ready");
    if (candidates.length > room) toast.warning("O pedido tem limite de 1.000 fotos.");
    const copies = candidates
      .slice(0, room)
      .map((photo) => ({ ...photo, id: uid(), name: `${photo.name} (cópia)` }));
    setPhotos((current) => [...current, ...copies]);
  }

  // Arrastar na própria grade: a ordem vira a ordem de impressão e dos arquivos.
  function reorderPhotos(id, over) {
    setPhotos((current) => movePhoto(current, id, current.findIndex((photo) => photo.id === over)));
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
    if (workRef.current) return;
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewsRef.current.clear();
    draftActiveRef.current = false;
    saveUploadDraft(userId, mode, []);
    preparedRef.current.clear();
    setPrintFailures(null);
    setPhotos([]);
    setSelected([]);
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
    const targets = bulkTargets();
    setBulk((current) => ({ ...current, sizeId, border: size.is_photo_3x4 ? false : current.border }));
    updatePhotos(targets, (photo) => applySize(photo, size));
    if (size.is_photo_3x4) {
      const first = readyPhotos.find((photo) => targets.includes(photo.id) && photo.kind !== "pdf");
      if (first) window.setTimeout(() => openEditor(first.id, targets), 0);
    }
  }

  function bulkSizeAll(sizeId = activeBulkSize) {
    const size = sizes.find((item) => item.id === sizeId);
    if (!size || !photos.length) return;
    setBulk((current) => ({ ...current, sizeId: size.id, border: size.is_photo_3x4 ? false : current.border }));
    updatePhotos(photos.map((photo) => photo.id), (photo) => applySize(photo, size));
    if (size.is_photo_3x4) {
      const editable = readyPhotos.filter((photo) => photo.kind !== "pdf");
      if (editable.length) window.setTimeout(() => openEditor(editable[0].id, editable.map((photo) => photo.id)), 0);
    }
    toast.success(`${isPolaroid ? "Modelo" : "Formato"} ${size.name} aplicado a todas as ${photos.length} ${isPolaroid ? "polaroides" : "fotos"}.`);
  }

  function bulkPatch(patch) {
    setBulk((current) => ({ ...current, ...patch }));
    updatePhotos(bulkTargets(), (photo) => {
      const next = {
        ...photo,
        ...patch,
        ...(photo.is_photo_3x4 && patch.border ? { border: false } : {}),
        ...(patch.fit !== undefined ? { zoom: 1, ox: 0, oy: 0 } : {}),
      };
      return patch.fit !== undefined ? { ...next, ...evaluatePhoto(next) } : next;
    });
  }

  function requestAddToCart(event) {
    reviewFocusRef.current = event.currentTarget;
    void addToCart(confirmedReview);
  }

  function reviewThumbnails() {
    reviewFocusRef.current = thumbnailAreaRef.current;
    setFilter("all");
    setSearch("");
    setReviewOpen(false);
  }

  async function addToCart(reviewAccepted) {
    if (workRef.current || !readyPhotos.length) return;
    if (errorCount) {
      toast.error("Tente reenviar ou remova as fotos com erro antes de continuar.");
      return;
    }
    if (readyPhotos.length + cartFiles > MAX_ORDER_PHOTOS) {
      toast.error("O pedido tem limite de 1.000 fotos.");
      return;
    }
    if (needsConfirmation && !reviewAccepted) {
      setReviewOpen(true);
      return;
    }
    if (readyPhotos.some((photo) => photo.is_photo_3x4 && photo.kind === "pdf")) {
      toast.error("Para revelar 3×4, envie a foto em JPG, PNG ou WEBP para ajustar o enquadramento.");
      return;
    }
    workRef.current = true;
    setBusy("Preparando arquivos de impressão…");
    try {
      const prepared = [];
      const failed = [];
      for (let index = 0; index < readyPhotos.length; index += 1) {
        const photo = readyPhotos[index];
        setBusy(`Preparando arquivo ${index + 1} de ${readyPhotos.length}…`);
            const model = sizes.find((size) => size.id === photo.sizeId) || null;
        const cached = preparedRef.current.get(photo.id);
        if (cached?.photo === photo && cached.model === model) {
          prepared.push({ ...cached.result, position: index, confirmed_issue: reviewAccepted || (photo.confirmed || []).length > 0 });
          continue;
        }
        try {
          // O PDF já é o arquivo final de impressão: vai para a produção como enviado.
          let printUri = photo.file_uri;
          let printName = photo.name;
          if (photo.kind !== "pdf") {
            const image = await loadImage(photo.preview);
            const canvas = photo.is_photo_3x4
              ? await canvasFromPhoto34Sheet({ ...photo, area: mode }, image)
              : await canvasFromPhoto({ ...photo, area: mode }, image, isPolaroid ? model : null);
            const blob = await canvasToBlob(canvas);
            const safeName = String(photo.name || "foto").replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "_").slice(0, 40) || "foto";
            const safeSize = String(photo.sizeLabel || "impressao").replace(/\W+/g, "");
            const file = new File([blob], `${safeName}_${safeSize}_impressao.jpg`, {
              type: "image/jpeg",
            });
            ({ file_uri: printUri } = await base44.integrations.Core.UploadPrivateFile({ file }));
            printName = file.name;
          }
          const result = {
            position: index,
            sizeId: photo.sizeId,
            filename: photo.name,
            original_file_uri: photo.file_uri,
            print_file_uri: printUri,
            print_name: printName,
            size_name: photo.sizeLabel,
            width_cm: photo.wCm,
            height_cm: photo.hCm,
            print_orientation: photo.kind === "pdf" ? undefined : photo.printOrientation,
            fit_mode: photo.kind === "pdf" ? "original" : photo.fit,
            color_effect: photo.kind !== "pdf" ? photoColorEffect(photo.colorEffect) : undefined,
            border: photo.is_photo_3x4 ? false : photo.border,
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
            captionAreaEnabled: isPolaroid ? model?.has_caption !== false : undefined,
            caption_area_enabled: isPolaroid ? model?.has_caption !== false : undefined,
            polaroid_model: isPolaroid ? photo.sizeLabel : "",
            copies: photo.copies || 1,
            confirmed_issue: reviewAccepted || (photo.confirmed || []).length > 0,
            preview: photo.preview,
          };
          preparedRef.current.set(photo.id, { photo, model, result });
          prepared.push(result);
        } catch {
          failed.push(photo.name);
        }
      }

      if (failed.length) {
        setPrintFailures({ failed, ready: prepared.length });
        return;
      }
      setPrintFailures(null);
      const photoBatch = uid();
      const groups = new Map();
      prepared.forEach((photo) => {
        const key = photo.sizeId;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(photo);
      });

      const items = Array.from(groups.entries()).map(([sizeId, group]) => {
        const size = sizes.find((item) => item.id === sizeId);
        const sizeName = group[0].size_name;
        const tier = tierMap[size?.id];
        // O carrinho persistido guarda um preço público. A tela e o checkout
        // consultam a conta atual para aplicar os preços profissionais.
        const publicTier = group[0]?.is_photo_3x4 || tier?.pricing_table === "profissional" ? null : tier;
        const unit = Number(publicTier?.unit ?? size?.price ?? 0);
        const borderPrice = Number(size?.border_price) || 0;
        const total = group.reduce(
          (sum, photo) => sum + (unit + (photo.border ? borderPrice : 0)) * Math.max(1, photo.copies || 1),
          0
        );
        return {
          key: uid(),
          photoBatch,
          area: mode,
          ref_id: size?.id,
          title: `${isPolaroid ? "Polaroid" : "Revelação"} ${sizeName}`,
          subtitle: `${group.length} foto(s)`,
          borderPrice,
          tierLabel: publicTier?.tier?.label || "",
          options: group[0]?.is_photo_3x4 ? { photo_3x4: true } : {},
          unitPrice: Math.round(total * 100) / 100,
          qty: 1,
          photos: group,
          image: group[0]?.preview,
        };
      });

      if (!addItems(items)) return;
      draftActiveRef.current = false;
      saveUploadDraft(userId, mode, []);
      toast.success("Fotos adicionadas ao carrinho");
      navigate({ to: "/carrinho" });
    } catch (error) {
      toast.error(error?.message || "Não foi possível preparar os arquivos. Tente novamente.");
    } finally {
      workRef.current = false;
      setBusy("");
    }
  }

  const editingPhoto = editor && readyPhotos.find((photo) => photo.id === editor.id);
  const editingIndex = editor?.sequence.indexOf(editor.id) ?? -1;
  const previewPhoto = photos.find((photo) => photo.id === previewId && photo.kind !== "pdf");

  useEffect(() => {
    const previews = previewsRef.current;
    return () => { previews.forEach((url) => URL.revokeObjectURL(url)); previews.clear(); };
  }, []);

  useEffect(() => {
    setSavedUpload(readUploadDraft(userId, mode));
  }, [userId, mode]);

  useEffect(() => {
    pendingImportHandler.current = (entries) => withUpload(() => importPreparedEntries(entries));
  });

  useEffect(() => {
    if (isLoading || !defaultSize) return;
    const staged = consumePendingPhotoImport(mode);
    if (staged?.length) pendingImportHandler.current?.(staged);
  }, [mode, isLoading, defaultSize?.id]);

  useEffect(() => {
    draftPhotosRef.current = photos;
    if (!draftActiveRef.current) return undefined;
    const timer = setTimeout(() => saveUploadDraft(userId, mode, photos), 250);
    return () => clearTimeout(timer);
  }, [userId, mode, photos]);

  useEffect(() => {
    function flush() {
      if (draftActiveRef.current) saveUploadDraft(userId, mode, draftPhotosRef.current);
    }
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [userId, mode]);

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

  if (isLoading || quantityPricing.isLoading) {
    return <div role="status" className="container-x py-24 text-center text-sm text-muted-foreground">Carregando formatos e preços…</div>;
  }
  if (quantityPricing.professionalError) {
    return <div className="container-x py-12"><Button variant="outline" onClick={() => quantityPricing.retryProfessional()}>Tentar carregar preços da conta</Button></div>;
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
          {!isPolaroid && quantityPricing.data.professional && (
            <p className="mt-2 text-xs font-semibold text-primary">Tabela profissional disponível para sua conta</p>
          )}
        </div>
        {photos.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Limpar tudo
          </Button>
        )}
      </div>

      {!isPolaroid && readyPhotos.some((photo) => photo.is_photo_3x4) && (
        <div role="note" className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-gold/60 bg-gold-soft/35 px-4 py-3 text-sm leading-relaxed">
          <p className="max-w-3xl">
            <strong>Foto 3×4:</strong> indicada para escola, currículo e documentos não oficiais. Não é válida para documentos oficiais.
            Cada folha contém 12 fotos de 3,1 × 4,1 cm, montadas em 15,2 × 13,5 cm. O preço é calculado por folha.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={openPhoto34SheetPreview} disabled={sheetPreviewBusy}>
            {sheetPreviewBusy ? "Montando prévia…" : "Ver prévia da folha"}
          </Button>
        </div>
      )}

      <Dialog open={Boolean(sheetPreview) || sheetPreviewBusy} onOpenChange={(open) => { if (!open && !sheetPreviewBusy) setSheetPreview(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prévia da folha 3×4</DialogTitle>
            <DialogDescription>
              Uma folha de 15,2 × 13,5 cm com 12 fotos de 3,1 × 4,1 cm e espaçamento de 3,2 mm. Esta prévia usa o enquadramento salvo para {sheetPreview?.name || "a foto selecionada"}.
            </DialogDescription>
          </DialogHeader>
          {sheetPreviewBusy && <p className="py-12 text-center text-sm text-muted-foreground">Montando a folha em resolução de impressão…</p>}
          {sheetPreview?.url && <img src={sheetPreview.url} alt="Prévia da folha com 12 fotos 3×4" className="mx-auto h-auto max-h-[62vh] w-full border border-border object-contain" />}
        </DialogContent>
      </Dialog>

      <div className="mt-8">
        {savedUpload.length ? (
          <div className="rounded-xl border border-gold/50 bg-gold-soft/35 p-4">
            <p className="font-medium">Envio em andamento · {savedUpload.length} arquivo(s)</p>
            <p className="mt-1 text-sm text-muted-foreground">Continue neste navegador com as fotos já enviadas e os ajustes que ficaram salvos.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={resumeUpload} disabled={uploading}>{uploading ? "Restaurando…" : "Continuar envio"}</Button>
              <Button type="button" variant="outline" onClick={discardSavedUpload} disabled={uploading}>Descartar envio</Button>
            </div>
          </div>
        ) : (
          <>
            <UploadDropzone onFiles={handleFiles} uploading={uploading || Boolean(busy)} />
            {moduleEnabled(settings, "photo_duplicate_organizer") && <p className="mt-2 text-center text-xs text-muted-foreground">
              Antes de enviar, vamos separar arquivos duplicados e sugerir fotos parecidas para você revisar.
            </p>}
          </>
        )}
        {photos.some((photo) => photo.needsFile) && (
          <p className="mt-3 rounded-lg bg-secondary p-3 text-sm">Escolha novamente os arquivos que faltam ou remova as fotos marcadas com erro.</p>
        )}
        {photos.length > 0 ? (
          <section aria-labelledby="apply-all-size-title" className="mt-4 rounded-2xl border border-gold/70 bg-gold-soft/45 p-4 font-body shadow-sm sm:flex sm:items-end sm:justify-between sm:gap-5 sm:p-5">
            <div className="min-w-0 sm:flex-1">
              <p className="eyebrow font-body text-xs tracking-[0.12em]">Atalho rápido · {photos.length} {isPolaroid ? "polaroides" : "fotos"}</p>
              <h2 id="apply-all-size-title" className="mt-1 font-body text-base font-semibold tracking-normal sm:text-lg">
                {isPolaroid ? "Aplicar modelo a todas as polaroides" : "Aplicar tamanho a todas as fotos"}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {isPolaroid
                  ? "Escolha o modelo. A alteração só acontece ao tocar no botão, e a área quadrada da foto é mantida."
                  : "Escolha o formato. A alteração só acontece ao tocar no botão; as miniaturas respeitam a orientação e o corte configurado."}
              </p>
            </div>
            <div className="mt-3 grid gap-2 sm:mt-0 sm:w-full sm:max-w-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="block min-w-0">
                <span className="text-xs font-medium text-foreground">{isPolaroid ? "Modelo para todas" : "Formato para todas"}</span>
                <select
                  value={activeAllPhotosSize}
                  onChange={(event) => setAllPhotosSizeId(event.target.value)}
                  disabled={uploading || Boolean(busy)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  aria-label={isPolaroid ? "Modelo de todas as polaroides" : "Formato de todas as fotos"}
                >
                  {sizes.map((size) => (
                    <option key={size.id} value={size.id}>{size.name}</option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                onClick={() => bulkSizeAll(activeAllPhotosSize)}
                disabled={!photos.length || uploading || Boolean(busy)}
                className="w-full gap-1.5 whitespace-nowrap sm:w-auto"
              >
                <CheckCheck className="h-4 w-4" /> Aplicar a todas ({photos.length})
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      {photos.length === 0 ? (
        <>
          <UploadTips />
          {!savedUpload.length && <DraftNotice count={savedDraft} onClear={clearDraft} />}
        </>
      ) : null}

      {photos.length > 0 && <div role="status" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 text-xs">
        <span><strong>{readyPhotos.length}</strong> enviados</span>
        <span><strong>{photos.length - readyPhotos.length - errorCount}</strong> aguardando ou enviando</span>
        {errorCount > 0 && <span className="text-destructive"><strong>{errorCount}</strong> com falha</span>}
        {retryableCount > 0 && !uploading && <Button type="button" size="sm" variant="outline" onClick={retryErrors}
          disabled={!retryableCount}>
          Reenviar arquivos com falha
        </Button>}
      </div>}
      {progress ? (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {progress.phase === "analysis" ? "Verificando fotos" : "Enviando fotos"} {progress.done} de {progress.total}…
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
            sizeIds={tierSizeIds}
            sizes={sizes}
            tierMap={tierMap}
            pricing={quantityPricing.data}
          />

          <div
            ref={thumbnailAreaRef}
            tabIndex={-1}
            className="mt-3 scroll-mt-32 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground"
          >
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
              disabled={uploading || Boolean(busy)}
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
                onClick={() => setConfirmDeleteSelected(true)}
                disabled={uploading || Boolean(busy)}
                className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2.5 py-1 font-medium text-red-700 underline-offset-4 transition hover:border-red-400 hover:bg-red-100 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir selecionadas ({selected.length})
              </button>
            ) : null}
            {selected.length ? (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                <X className="h-3.5 w-3.5" /> Limpar seleção ({selected.length})
              </button>
            ) : null}
            {retryableCount ? (
              <button
                type="button"
                onClick={retryErrors}
                disabled={uploading}
                className="text-amber-700 underline-offset-4 hover:underline disabled:opacity-50"
              >
                Tentar novamente ({retryableCount})
              </button>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <GripVertical className="h-3.5 w-3.5" />
              {canDrag ? "Use a alça para mover · toque na foto para ampliar" : uploading || busy ? "Aguarde o processamento para ordenar" : "Limpe busca e filtro para arrastar"}
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
                      if (!size) return;
                      updatePhotos([id], (item) => applySize(item, size));
                      if (size.is_photo_3x4) window.setTimeout(() => openEditor(id, [id]), 0);
                    }}
                    onEdit={openEditor}
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

          {printFailures && (
            <div className="mt-6 rounded-xl border border-gold/50 bg-gold-soft/35 p-4" role="status">
              <p className="font-medium">{printFailures.ready} arquivo(s) preparado(s) · {printFailures.failed.length} com falha</p>
              <p className="mt-1 text-sm text-muted-foreground break-words">{printFailures.failed.slice(0, 5).join(", ")}{printFailures.failed.length > 5 ? "…" : ""}</p>
              <Button type="button" size="sm" className="mt-3" onClick={requestAddToCart} disabled={Boolean(busy) || uploading}>Tentar novamente</Button>
            </div>
          )}
          <PhotoReview
            readyCount={readyPhotos.length}
            printCount={totalPrints}
            problemPhotos={problemPhotos}
            needsConfirmation={needsConfirmation}
            confirmed={confirmedReview}
            onConfirmedChange={(checked) => setReviewedPhotos(checked ? photos : null)}
            onEdit={openEditor}
            onUseWhole={(id) =>
              updatePhotos([id], (item) => {
                const next = { ...item, fit: "contain", zoom: 1, ox: 0, oy: 0 };
                return { ...next, ...evaluatePhoto(next) };
              })
            }
            total={totalPrice}
            busy={Boolean(busy) || uploading}
            onAdd={requestAddToCart}
            tierArea={mode}
            tierLines={tierLines}
            tierGroups={displayPricing.groups}
            tierTiers={displayPricing.tiers}
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
          index={editingIndex}
          total={editor.sequence.length}
          previousId={editor.sequence[editingIndex - 1]}
          nextId={editor.sequence[editingIndex + 1]}
          onClose={() => setEditor(null)}
          onSave={(updated, options, nextPhotoId) => {
            setEditor(nextPhotoId ? { ...editor, id: nextPhotoId } : null);
            if (!updated) return;
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
          }}
        />
      )}

      {previewPhoto && (
        <PhotoPreviewDialog
          photo={previewPhoto}
          model={isPolaroid ? sizes.find((size) => size.id === previewPhoto.sizeId) : null}
          onClose={() => setPreviewId(null)}
          onEdit={openEditor}
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
            setPhotos((current) => [...current].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity)));
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
        onSizeAll={bulkSizeAll}
        fit={bulk.fit}
        onFitChange={(fit) => bulkPatch({ fit })}
        border={bulk.border}
        onBorderChange={(border) => bulkPatch({ border })}
        showBorder={!isPolaroid && !sizes.find((size) => size.id === activeBulkSize)?.is_photo_3x4}
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

      <AlertDialog open={confirmDeleteSelected} onOpenChange={setConfirmDeleteSelected}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir as fotos selecionadas?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected.length} {selected.length === 1 ? "foto será removida" : "fotos serão removidas"} deste envio.
              Depois, você poderá usar “Desfazer” na mensagem que aparecer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter fotos</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePhotos(selected)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir {selected.length === 1 ? "foto" : "fotos"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(duplicateReview)} onOpenChange={(open) => { if (!open) setDuplicateReview(null); }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100%_-_1rem)] max-w-4xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pr-6 text-left">
            <DialogTitle className="text-xl leading-tight">Revise fotos repetidas antes do envio</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-foreground">
              Escolha quais imagens entram neste pedido. As fotos não são removidas do seu aparelho.
            </DialogDescription>
          </DialogHeader>
          {duplicateReview && <PhotoDuplicateReview
            entries={duplicateReview}
            onContinue={continueDuplicateReview}
            onCancel={() => setDuplicateReview(null)}
          />}
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent
          className="max-h-[90dvh] w-[calc(100%_-_1rem)] overflow-y-auto rounded-xl p-5 sm:p-6"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = reviewFocusRef.current;
            target?.focus();
            if (target === thumbnailAreaRef.current) target?.scrollIntoView({ block: "start" });
          }}
        >
          <DialogHeader className="pr-6 text-left">
            <DialogTitle className="text-xl leading-tight">Confira os cortes das fotos</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-foreground">
              Revise cada foto pelas miniaturas e veja se o assunto principal ficou cortado.
              Se precisar corrigir o corte, volte às miniaturas e toque no lápis da foto para editar o enquadramento.
            </DialogDescription>
          </DialogHeader>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-gold/60 bg-gold-soft/30 p-3 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 accent-primary"
              onChange={(event) => {
                if (!event.target.checked) return;
                setReviewedPhotos(photos);
                setReviewOpen(false);
                void addToCart(true);
              }}
            />
            Revisei os avisos e quero manter este enquadramento.
          </label>
          <p className="text-xs text-muted-foreground">Ao marcar, as fotos serão adicionadas e você irá para o carrinho.</p>
          <Button type="button" variant="outline" onClick={reviewThumbnails} className="justify-self-start">
            Voltar às miniaturas
          </Button>
        </DialogContent>
      </Dialog>

      <StudioActionBar
        photoCount={readyPhotos.length}
        total={totalPrice}
        alertCount={problemPhotos.length}
        selectedCount={selected.length}
        busy={Boolean(busy) || uploading}
        onAdd={requestAddToCart}
        onOpenBulk={() => setBulkOpen(true)}
      />
    </div>
  );
}
