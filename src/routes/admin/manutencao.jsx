import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Power, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/lib/store";
import { countPhotosByPeriod, purgePhotosByPeriod } from "@/lib/store-fns";

export const Route = createFileRoute("/admin/manutencao")({
  head: () => ({ meta: [{ title: "Manutenção — Paracolor" }] }),
  component: MaintenancePage,
});

const pad = (value) => String(value).padStart(2, "0");
function isoDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function formatDay(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function MaintenancePage() {
  const { settings, isLoading } = useSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const today = new Date();
  const [period, setPeriod] = useState({
    from: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: isoDay(today),
  });
  const [found, setFound] = useState(null);
  const [checking, setChecking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [purging, setPurging] = useState(false);
  const countPhotos = useServerFn(countPhotosByPeriod);
  const purgePhotos = useServerFn(purgePhotosByPeriod);

  useEffect(() => {
    if (settings && !form) {
      setForm({
        maintenance_enabled: Boolean(settings.maintenance_enabled),
        maintenance_title: settings.maintenance_title || "",
        maintenance_message: settings.maintenance_message || "",
        maintenance_return: settings.maintenance_return || "",
      });
    }
  }, [settings, form]);

  async function saveMaintenance() {
    setSaving(true);
    try {
      await base44.entities.Settings.update(settings.id, form);
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success(form.maintenance_enabled ? "Loja em manutenção" : "Loja no ar novamente");
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function checkPeriod() {
    setChecking(true);
    setFound(null);
    setConfirmed(false);
    try {
      const result = await countPhotos({ data: period });
      setFound(result.count);
    } catch (error) {
      toast.error(error?.message || "Não foi possível consultar as fotos.");
    } finally {
      setChecking(false);
    }
  }

  async function purge() {
    setPurging(true);
    try {
      const result = await purgePhotos({ data: period });
      toast.success(`${result.deleted} foto(s) apagada(s)`);
      setFound(0);
      setConfirmed(false);
    } catch (error) {
      toast.error(error?.message || "Não foi possível apagar as fotos.");
    } finally {
      setPurging(false);
    }
  }

  if (isLoading || !form) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Sistema</p>
        <h1 className="mt-1 text-3xl">Manutenção</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Tire a loja do ar enquanto ajusta o site e apague as fotos enviadas em um período.
        </p>
      </div>

      <section className="card-glass p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl">Modo manutenção</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Com o modo ligado, visitantes veem apenas o aviso de manutenção. Você, como administrador, continua navegando
              pelo site normalmente.
            </p>
          </div>
          <Switch
            checked={form.maintenance_enabled}
            onCheckedChange={(checked) => setForm({ ...form, maintenance_enabled: checked })}
          />
        </div>

        {form.maintenance_enabled && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-xs text-accent-foreground">
            <Power className="h-3.5 w-3.5" /> A loja está fechada para clientes até você desligar este modo.
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">Título do aviso</span>
            <input
              value={form.maintenance_title}
              onChange={(event) => setForm({ ...form, maintenance_title: event.target.value })}
              placeholder="Voltamos em breve"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">Previsão de retorno</span>
            <input
              value={form.maintenance_return}
              onChange={(event) => setForm({ ...form, maintenance_return: event.target.value })}
              placeholder="Hoje, às 18h"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm">
          <span className="text-xs text-muted-foreground">Mensagem para os clientes</span>
          <textarea
            value={form.maintenance_message}
            onChange={(event) => setForm({ ...form, maintenance_message: event.target.value })}
            rows={3}
            placeholder="Estamos ajustando a loja para você. Enquanto isso, fale com a gente pelo WhatsApp."
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <Button className="mt-5" onClick={saveMaintenance} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
        </Button>
      </section>

      <section className="card-glass p-6">
        <h2 className="text-xl">Apagar fotos por período</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Remove do app as fotos enviadas entre as duas datas. Antes de apagar, confira quantas fotos existem no período.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">De</span>
            <input
              type="date"
              value={period.from}
              onChange={(event) => {
                setPeriod({ ...period, from: event.target.value });
                setFound(null);
              }}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">Até</span>
            <input
              type="date"
              value={period.to}
              onChange={(event) => {
                setPeriod({ ...period, to: event.target.value });
                setFound(null);
              }}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <Button variant="outline" onClick={checkPeriod} disabled={checking || !period.from || !period.to}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Consultar
          </Button>
        </div>

        {found !== null && (
          <div className="mt-5 rounded-xl bg-secondary/70 p-4">
            <p className="text-sm">
              <strong className="font-display text-lg">{found}</strong> foto(s) enviada(s) entre {formatDay(period.from)} e{" "}
              {formatDay(period.to)}.
            </p>
            {found > 0 ? (
              <>
                <p className="mt-2 flex items-start gap-2 text-xs text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  As fotos saem dos pedidos desse período, inclusive de pedidos que ainda estejam em produção. Não dá para
                  desfazer.
                </p>
                <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  Entendi e quero apagar essas fotos
                </label>
                <Button variant="destructive" className="mt-3 gap-2" onClick={purge} disabled={!confirmed || purging}>
                  {purging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Apagar {found} foto(s)
                </Button>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Nenhuma foto enviada neste período.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}