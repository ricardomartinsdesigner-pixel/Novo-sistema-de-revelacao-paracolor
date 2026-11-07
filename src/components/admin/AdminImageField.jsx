import { useState } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { fileSummary, uploadSiteImage } from "@/lib/admin-upload";

/** Campo de foto do painel: prévia, formato, tamanho e erro de envio visíveis. */
export default function AdminImageField({ value, onChange, hint }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { url, bytes } = await uploadSiteImage(file);
      onChange(url);
      toast.success(`Foto publicada — ${file.name} · ${fileSummary({ ...file, size: bytes || file.size })}`);
    } catch (error) {
      toast.error(error?.message || "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="URL da imagem"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-xs">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Enviando" : "Enviar"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={handleFile}
          />
        </label>
      </div>
      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="Prévia da foto escolhida" className="h-16 w-16 rounded-lg border border-border object-cover" />
          <p className="text-[11px] text-muted-foreground">Prévia do arquivo que será publicado.</p>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" /> Nenhuma foto escolhida ainda.
        </p>
      )}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}