import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettingsForm } from "@/hooks/use-settings-form";
import { purgeOriginals } from "@/lib/store-fns";

export const Route = createFileRoute("/admin/arquivos")({
  head: () => ({ meta: [{ title: "Arquivos e retenção — Paracolor" }] }),
  component: FilesPage,
});

function FilesPage() {
  const queryClient = useQueryClient();
  const [purging, setPurging] = useState(false);
  const { form, setForm, saving, save, isLoading } = useSettingsForm((settings) => ({
    retention_days: settings.retention_days ?? 90,
    retention_auto: settings.retention_auto !== false,
  }));
  const purge = useServerFn(purgeOriginals);

  const stats = useQuery({
    queryKey: ["retention-stats"],
    queryFn: async () => {
      const total = await base44.entities.OrderPhoto.count({});
      const withOriginals = await base44.entities.OrderPhoto.count({ original_file_uri: { $exists: true } });
      return { total, withOriginals };
    },
  });

  async function runPurge() {
    setPurging(true);
    try {
      const result = await purge({ data: { days: Number(form.retention_days) || 90 } });
      toast.success(`Originais removidos: ${result.purged}`);
      queryClient.invalidateQueries({ queryKey: ["retention-stats"] });
    } catch (error) {
      toast.error(error.message || "Não foi possível executar a retenção.");
    } finally {
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
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar</Button>
          <Button variant="outline" onClick={runPurge} disabled={purging}>
            {purging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Executar retenção agora
          </Button>
        </div>
      </section>

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