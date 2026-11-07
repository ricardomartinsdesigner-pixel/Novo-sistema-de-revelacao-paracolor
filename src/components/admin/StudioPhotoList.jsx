import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEntityList } from "@/lib/store";
import { uploadSiteImage } from "@/lib/admin-upload";

/** Fotos de uma galeria: envio múltiplo, texto alternativo, ordem e remoção. */
export default function StudioPhotoList({ gallery }) {
  const queryClient = useQueryClient();
  const { data: photos = [], isLoading, isError, refetch } = useEntityList(
    "StudioPhoto",
    { gallery_id: gallery.id },
    { sort: "sort" }
  );
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["StudioPhoto"] });
  }

  async function addFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setUploading(true);
    let nextSort = photos.length;
    let failures = 0;
    for (let index = 0; index < files.length; index += 1) {
      setProgress(`Enviando ${index + 1} de ${files.length}…`);
      try {
        const { url } = await uploadSiteImage(files[index]);
        await base44.entities.StudioPhoto.create({
          gallery_id: gallery.id,
          image_url: url,
          alt: files[index].name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
          authorized: Boolean(gallery.authorized),
          active: true,
          sort: nextSort,
        });
        nextSort += 1;
      } catch (error) {
        failures += 1;
        toast.error(`${files[index].name}: ${error?.message || "não foi possível enviar."}`);
      }
    }
    setUploading(false);
    setProgress("");
    await refresh();
    if (!failures) toast.success(`${files.length} foto(s) adicionada(s) à galeria.`);
  }

  async function move(photo, direction) {
    const position = photos.findIndex((item) => item.id === photo.id);
    const neighbour = photos[position + direction];
    if (!neighbour) return;
    await base44.entities.StudioPhoto.bulkUpdate([
      { id: photo.id, sort: position + direction },
      { id: neighbour.id, sort: position },
    ]);
    await refresh();
  }

  async function patch(photo, values) {
    await base44.entities.StudioPhoto.update(photo.id, values);
    await refresh();
  }

  async function remove(photo) {
    if (!confirm("Remover esta foto da galeria?")) return;
    await base44.entities.StudioPhoto.delete(photo.id);
    await refresh();
    toast.success("Foto removida");
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base">Fotos da galeria</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            PNG, JPG ou WEBP até 8 MB. Use as setas para ordenar e escreva o texto alternativo de cada foto.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Enviando" : "Adicionar fotos"}
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={addFiles}
          />
        </label>
      </div>
      {progress ? <p className="mt-2 text-[11px] text-muted-foreground">{progress}</p> : null}

      {isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando fotos…
        </p>
      ) : isError ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      ) : photos.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {photos.map((photo, position) => (
            <li key={photo.id} className="rounded-xl border border-border p-3">
              <div className="flex gap-3">
                <img
                  src={photo.image_url}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    defaultValue={photo.alt || ""}
                    onBlur={(event) => {
                      if (event.target.value !== (photo.alt || "")) patch(photo, { alt: event.target.value });
                    }}
                    placeholder="Texto alternativo da foto"
                    aria-label="Texto alternativo da foto"
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={photo.active !== false}
                      onCheckedChange={(checked) => patch(photo, { active: checked })}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {photo.active !== false ? "Aparece no site" : "Oculta"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(photo, -1)}
                  disabled={position === 0}
                  aria-label="Mover foto para cima"
                  className="rounded p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(photo, 1)}
                  disabled={position === photos.length - 1}
                  aria-label="Mover foto para baixo"
                  className="rounded p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(photo)}
                  aria-label="Remover foto"
                  className="ml-auto rounded p-1.5 text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Nenhuma foto nesta galeria ainda.
        </p>
      )}
    </div>
  );
}