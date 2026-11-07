import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Label } from "@/components/ui/label";

export default function SiteImageField({ label, hint, value, fallback, onChange }) {
  const [busy, setBusy] = useState(false);
  const shown = value || fallback || "";

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      onChange(file_url);
      toast.success("Imagem enviada");
    } catch (error) {
      toast.error(error?.message || "Não foi possível enviar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-3">
        <div className="h-16 w-24 flex-none overflow-hidden rounded-lg border border-border bg-secondary/50">
          {shown ? (
            <Image src={shown} alt={label} className="h-full w-full object-contain" fittingType="fit" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">sem imagem</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-input px-3 py-1.5 text-xs transition hover:border-primary/50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {shown ? "Trocar imagem" : "Enviar imagem"}
            <input type="file" accept="image/*" onChange={upload} className="hidden" disabled={busy} />
          </label>
          {value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 rounded-full border border-input px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Usar padrão
            </button>
          ) : null}
        </div>
      </div>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}