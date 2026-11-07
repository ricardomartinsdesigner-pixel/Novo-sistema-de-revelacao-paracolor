import { useState } from "react";
import { Loader2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { fileSummary, uploadSiteVideo } from "@/lib/admin-upload";

/** Campo de vídeo do painel: envia o arquivo (MP4/WEBM) e mostra a prévia. */
export default function AdminVideoField({ value, onChange, hint }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadSiteVideo(file);
      onChange(url);
      toast.success(`Vídeo publicado — ${file.name} · ${fileSummary(file)}`);
    } catch (error) {
      toast.error(error?.message || "Não foi possível enviar o vídeo.");
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
          placeholder="URL do vídeo"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-xs">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Enviando" : "Enviar"}
          <input
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            disabled={uploading}
            onChange={handleFile}
          />
        </label>
      </div>
      {value ? (
        <div className="flex items-center gap-3">
          <video src={value} className="h-16 w-28 rounded-lg border border-border object-cover" muted playsInline preload="metadata" />
          <p className="text-[11px] text-muted-foreground">Prévia do vídeo que será publicado.</p>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Video className="h-3.5 w-3.5" /> Nenhum vídeo enviado ainda.
        </p>
      )}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}