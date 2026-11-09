import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/areas";
import { useSettingsForm } from "@/hooks/use-settings-form";
import { getOriginalRetentionPreview, purgeOriginals } from "@/lib/store-fns";

export const Route = createFileRoute("/admin/arquivos")({
  head: () => ({ meta: [{ title: "Arquivos e retenção — Paracolor" }] }),
  component: FilesPage,
});

function FilesPage() {
  const queryClient = useQueryClient();
  const [purging, setPurging] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null);
  const { form, setForm, saving, save, isLoading } = useSettingsForm((settings) => ({
    retention_days: settings.retention_days ?? 90,
    retention_auto: settings.retention_auto !== false,
  }));
  const purge = useServerFn(purgeOriginals);
  const consult = useServerFn(getOriginalRetentionPreview);

  const stats = useQuery({
    queryKey: ["retention-stats"],
    queryFn: async () => {
      const total = await base44.entities.OrderPhoto.count({});
      const withOriginals = await base44.entities.OrderPhoto.count({ original_file_uri: { $nin: [null, ""], $exists: true } });
      const history = await base44.entities.RetentionRun.filter({ id: "latest" }, { limit: 1 });
      return { total, withOriginals, last: history.items?.[0] };
    },
  });

  async function reviewPurge() {
    setPreviewing(true);
    setPreview(null);
    try {
      setPreview(await consult());
    } catch (error) {
      toast.error(error?.message || "Não foi possível consultar os originais.");
    } finally {
      setPreviewing(false);
    }
  }

  async function runPurge() {
    if (!preview?.count) return;
    setPurging(true);
    try {
      const result = await purge({ data: { days: preview.days, cutoff: preview.cutoff, signature: preview.signature } });
      toast.success(`Originais retirados: ${result.purged}. Arquivos apagados do disco: ${result.files}.`);
      queryClient.invalidateQueries({ queryKey: ["retention-stats"] });
    } catch (error) {
      toast.error(error.message || "Não foi possível executar a retenção.");
    } finally {
      setPreview(null);
      setPurging(false);
    }
  }

  if (isLoading || !form) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Sistema</p>
        <h1 className="mt-1 text-3xl">Arquivos e retenção</h1>
      </div>

      <section className="card-glass p-5">
        <div className="flex items-start gap-3">
          <Archive className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <h2 className="text-lg">Retenção dos arquivos originais</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Depois que o pedido é enviado ou concluído, os arquivos originais são apagados do armazenamento após o prazo abaixo. As fotos prontas para impressão continuam salvas para reimpressão.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Apagar originais após (dias)
            <input
              type="number"
              min="1"
              max="730"
              value={form.retention_days}
              onChange={(event) => setForm({ ...form, retention_days: Number(event.target.value) || 1 })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            Executar automaticamente
            <Switch checked={form.retention_auto} onCheckedChange={(checked) => setForm({ ...form, retention_auto: checked })} />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => { setPreview(null); void save(); }} disabled={saving || previewing || purging}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar</Button>
          <Button variant="outline" onClick={reviewPurge} disabled={saving || previewing || purging}>
            {previewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Revisar retenção manual
          </Button>
        </div>
        {preview && (
          <div className="mt-4 rounded-lg border border-border p-4 text-sm" role="region" aria-label="Revisão da retenção">
            <p className="font-medium">Prazo salvo de {preview.days} {preview.days === 1 ? "dia" : "dias"}</p>
            <p className="mt-1 text-muted-foreground">
              {preview.total ? `${preview.total} original(is) elegíveis. Esta execução apaga ${preview.count}.` : "Nenhum original elegível para apagar."}
              {preview.total > preview.count && " Revise novamente para executar o próximo lote."}
            </p>
            {preview.count > 0 && <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="destructive" onClick={runPurge} disabled={purging}>
                {purging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar exclusão dos originais
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)} disabled={purging}>Cancelar</Button>
            </div>}
          </div>
        )}
      </section>

      {stats.data?.last && (
        <p className="text-xs text-muted-foreground">Última execução em {formatDate(stats.data.last.at)}.
          {stats.data.last.files} arquivo(s) e {(stats.data.last.bytes / 1048576).toFixed(2)} MB liberados no disco.</p>
      )}
      <section className="grid grid-cols-2 gap-3">
        <div className="card-glass p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fotos registradas</p>
          <p className="mt-1 font-display text-2xl">{stats.data?.total ?? "—"}</p>
        </div>
        <div className="card-glass p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Com original guardado</p>
          <p className="mt-1 font-display text-2xl">{stats.data?.withOriginals ?? "—"}</p>
        </div>
      </section>
    </div>
  );
}