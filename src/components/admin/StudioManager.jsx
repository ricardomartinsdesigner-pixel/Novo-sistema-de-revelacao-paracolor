import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import AdminImageField from "@/components/admin/AdminImageField";
import StudioPhotoList from "@/components/admin/StudioPhotoList";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEntityList } from "@/lib/store";

/** Galerias do Estúdio Fotográfico: criar, editar, publicar e ordenar fotos. */
export default function StudioManager() {
  const queryClient = useQueryClient();
  const { data: galleries = [], isLoading, isError, refetch } = useEntityList("StudioGallery", {}, { sort: "sort" });
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const selected = galleries.find((item) => item.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId && galleries.length) setSelectedId(galleries[0].id);
  }, [galleries, selectedId]);

  useEffect(() => {
    setDraft(
      selected
        ? {
            title: selected.title || "",
            description: selected.description || "",
            cover_url: selected.cover_url || "",
            cover_alt: selected.cover_alt || "",
            authorized: Boolean(selected.authorized),
            active: selected.active !== false,
            sort: selected.sort ?? 0,
          }
        : null
    );
  }, [selected]);

  async function createGallery() {
    setCreating(true);
    try {
      const record = await base44.entities.StudioGallery.create({
        title: "Nova galeria",
        active: false,
        authorized: false,
        sort: galleries.length,
      });
      await queryClient.invalidateQueries({ queryKey: ["StudioGallery"] });
      setSelectedId(record.id);
      toast.success("Galeria criada como rascunho. Publique quando estiver pronta.");
    } catch (error) {
      toast.error(error?.message || "Não foi possível criar a galeria.");
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    if (!selected || !draft) return;
    setSaving(true);
    try {
      await base44.entities.StudioGallery.update(selected.id, draft);
      await queryClient.invalidateQueries({ queryKey: ["StudioGallery"] });
      toast.success("Galeria salva");
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar a galeria.");
    } finally {
      setSaving(false);
    }
  }

  async function removeGallery() {
    if (!selected || !confirm("Excluir esta galeria e todas as fotos dela?")) return;
    await base44.entities.StudioPhoto.deleteMany({ gallery_id: selected.id });
    await base44.entities.StudioGallery.delete(selected.id);
    await queryClient.invalidateQueries({ queryKey: ["StudioGallery"] });
    await queryClient.invalidateQueries({ queryKey: ["StudioPhoto"] });
    setSelectedId("");
    toast.success("Galeria excluída");
  }

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando galerias…
      </p>
    );
  }

  if (isError) {
    return (
      <div className="card-glass p-5 text-sm">
        <p className="text-muted-foreground">Não foi possível carregar as galerias.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <div className="card-glass p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs text-muted-foreground">Galerias</p>
          <button
            type="button"
            onClick={createGallery}
            disabled={creating}
            className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Nova galeria"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>
        <ul className="mt-2 space-y-1">
          {galleries.map((gallery) => (
            <li key={gallery.id}>
              <button
                type="button"
                onClick={() => setSelectedId(gallery.id)}
                className={`w-full rounded-lg px-2 py-2 text-left text-sm transition ${
                  gallery.id === selectedId ? "bg-accent text-accent-foreground" : "hover:bg-secondary"
                }`}
              >
                <span className="block truncate">{gallery.title}</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                  {gallery.active !== false && gallery.authorized ? "publicada" : gallery.authorized ? "rascunho" : "sem autorização"}
                </span>
              </button>
            </li>
          ))}
          {!galleries.length ? (
            <li className="px-2 py-3 text-xs text-muted-foreground">Nenhuma galeria ainda.</li>
          ) : null}
        </ul>
      </div>

      {selected && draft ? (
        <div className="card-glass p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg">{selected.title || "Galeria"}</h2>
            <button
              type="button"
              onClick={removeGallery}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir galeria
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-xs text-muted-foreground">
              Título da galeria
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Descrição (opcional)
              <textarea
                rows={2}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <div className="text-xs text-muted-foreground">
              Capa da galeria (opcional)
              <div className="mt-1">
                <AdminImageField value={draft.cover_url} onChange={(url) => setDraft({ ...draft, cover_url: url })} />
              </div>
            </div>
            <label className="block text-xs text-muted-foreground">
              Descrição da capa (acessibilidade)
              <input
                value={draft.cover_alt}
                onChange={(event) => setDraft({ ...draft, cover_alt: event.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-muted-foreground">
                Ordem no site
                <input
                  type="number"
                  value={draft.sort}
                  onChange={(event) => setDraft({ ...draft, sort: Number(event.target.value) })}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={draft.active} onCheckedChange={(checked) => setDraft({ ...draft, active: checked })} />
                  Publicada no site
                </label>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={draft.authorized}
                    onCheckedChange={(checked) => setDraft({ ...draft, authorized: checked })}
                  />
                  <span>
                    Tenho autorização de uso das imagens de clientes desta galeria.
                    <span className="mt-0.5 block text-[10px]">Sem esta confirmação a galeria não aparece no site.</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="mt-4">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar galeria
          </Button>

          <StudioPhotoList gallery={selected} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Crie a primeira galeria para publicar as fotos dos ensaios.
        </div>
      )}
    </div>
  );
}