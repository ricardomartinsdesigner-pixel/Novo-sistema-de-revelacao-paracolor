import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadImage } from "@/lib/photo";
import { isPdfFile, prepareUploads } from "@/lib/upload-formats";

export function usePrivateImageUploads() {
  const [files, setFiles] = useState({});
  const [failures, setFailures] = useState({});
  const [active, setActive] = useState(null);
  const running = useRef(false);
  const mounted = useRef(false);
  const saved = useRef(new Map());
  const retryFiles = useRef(new Map());
  useEffect(() => {
    mounted.current = true;
    const previews = saved.current;
    const retry = retryFiles.current;
    return () => {
      mounted.current = false;
      previews.forEach((file) => { if (file.preview) URL.revokeObjectURL(file.preview); });
      previews.clear();
      retry.clear();
    };
  }, []);

  async function upload(slot, input) {
    if (!input || running.current) return;
    running.current = true;
    setActive(slot);
    setFailures((current) => ({ ...current, [slot]: null }));
    let preview = "";
    let converted = false;
    try {
      const { files: prepared } = await prepareUploads([input]);
      const file = prepared[0];
      if (!file) throw new Error("Não foi possível abrir o arquivo. Escolha uma versão em JPG, PNG ou PDF.");
      const pdf = isPdfFile(file);
      preview = pdf ? "" : URL.createObjectURL(file);
      const image = pdf ? null : await loadImage(preview);
      converted = true;
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      if (!mounted.current) return;
      const previous = saved.current.get(slot);
      if (previous?.preview) URL.revokeObjectURL(previous.preview);
      const attachment = { name: file.name, preview, file_uri, pdf, kind: pdf ? "pdf" : "image",
        w: image?.naturalWidth || 0, h: image?.naturalHeight || 0 };
      saved.current.set(slot, attachment);
      preview = "";
      retryFiles.current.delete(slot);
      setFiles((current) => ({ ...current, [slot]: attachment }));
    } catch (error) {
      if (!mounted.current) return;
      if (converted) retryFiles.current.set(slot, input);
      else retryFiles.current.delete(slot);
      setFailures((current) => ({ ...current, [slot]: {
        name: input.name, retryable: converted, message: converted ? error.message || "O envio falhou. Confira sua conexão." : "Não foi possível ler o arquivo. Escolha outra cópia.",
      } }));
    } finally {
      if (preview) URL.revokeObjectURL(preview);
      running.current = false;
      if (mounted.current) setActive(null);
    }
  }

  return { files, failures, active, upload, retry: (slot) => upload(slot, retryFiles.current.get(slot)) };
}
