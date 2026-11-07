import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Download, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

function formatBytes(value) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupRestorePanel({ settings }) {
  const inputRef = useRef(null);
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [backups, setBackups] = useState([]);
  const [schedule, setSchedule] = useState({ enabled: settings?.auto_backup_enabled !== false, time: settings?.auto_backup_time || "03:00", retention: settings?.auto_backup_retention || 7 });
  const [loadingList, setLoadingList] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    if (settings) setSchedule({ enabled: settings.auto_backup_enabled !== false, time: settings.auto_backup_time || "03:00", retention: settings.auto_backup_retention || 7 });
  }, [settings]);

  async function refreshBackups() {
    setLoadingList(true);
    try {
      const response = await fetch("/api/admin/backups", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível consultar backups.");
      const listed = result.backups || {};
      setBackups([...((listed.automatic || []).slice(0, 60)), ...((listed.before_restore || []).slice(0, 3))].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (error) {
      toast.error(error.message || "Não foi possível consultar backups.");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => { refreshBackups(); }, []);

  async function saveSchedule() {
    if (!settings?.id) return;
    setSavingSchedule(true);
    try {
      await base44.entities.Settings.update(settings.id, {
        auto_backup_enabled: schedule.enabled,
        auto_backup_time: schedule.time,
        auto_backup_retention: Math.max(1, Math.min(60, Number(schedule.retention) || 7)),
      });
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Agendamento de backup salvo.");
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar o agendamento.");
    } finally {
      setSavingSchedule(false);
    }
  }

  async function restore() {
    if (!file || confirmation !== "RESTAURAR") return;
    setRestoring(true);
    try {
      const response = await fetch("/api/admin/backup/restore", {
        method: "POST",
        headers: { "content-type": "application/gzip", "x-paracolor-restore-confirmation": confirmation },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível restaurar.");
      toast.success("Backup restaurado. A cópia do estado anterior está salva na lista de segurança.");
      setFile(null);
      setConfirmation("");
      if (inputRef.current) inputRef.current.value = "";
      await refreshBackups();
    } catch (error) {
      toast.error(error.message || "Falha na restauração.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <section className="card-glass space-y-5 p-5">
      <div>
        <p className="eyebrow">Proteção dos dados</p>
        <h2 className="mt-1 text-xl">Backup completo e restauração</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          O arquivo reúne o banco PostgreSQL, fotos e arquivos enviados, além de uma cópia das configurações de execução.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild className="gap-2"><a href="/api/admin/backup"><Download className="h-4 w-4" /> Baixar backup completo</a></Button>
        <p className="text-xs text-muted-foreground">Guarde o arquivo em outro dispositivo ou local seguro.</p>
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Backup automático diário</h3>
            <p className="mt-1 text-xs text-muted-foreground">O servidor cria uma cópia completa no horário de Brasília.</p>
          </div>
          <div className="flex items-center gap-2 text-sm"><Switch checked={schedule.enabled} onCheckedChange={(enabled) => setSchedule({ ...schedule, enabled })} /><span>{schedule.enabled ? "Ativado" : "Desativado"}</span></div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-xs text-muted-foreground">Horário
            <input type="time" value={schedule.time} onChange={(event) => setSchedule({ ...schedule, time: event.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">Manter backups diários (1–60)
            <input type="number" min="1" max="60" value={schedule.retention} onChange={(event) => setSchedule({ ...schedule, retention: Math.max(1, Math.min(60, Number(event.target.value) || 1)) })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          <Button type="button" onClick={saveSchedule} disabled={savingSchedule} className="gap-2">{savingSchedule ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Salvar agendamento</Button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
        <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" /> Backup contém dados privados e credenciais</p>
        <p className="mt-1">Proteja o arquivo. Restaurar substitui os dados atuais. Antes disso, o sistema cria automaticamente uma cópia do estado atual para recuperação.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
        <label className="text-xs text-muted-foreground">
          Arquivo de backup Paracolor (.tar.gz)
          <input ref={inputRef} type="file" accept=".gz,.tgz,application/gzip" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-1 block w-full rounded-lg border border-input bg-background p-2 text-sm text-foreground" />
        </label>
        <label className="text-xs text-muted-foreground">
          Para confirmar, digite RESTAURAR
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} autoComplete="off" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        <Button type="button" variant="destructive" onClick={restore} disabled={!file || confirmation !== "RESTAURAR" || restoring} className="gap-2">
          {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
          Restaurar backup
        </Button>
      </div>
      {file ? <p className="text-xs text-muted-foreground">Selecionado: {file.name} · {formatBytes(file.size)}</p> : null}

      <div className="border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Backups salvos no servidor</h3>
          <Button type="button" variant="ghost" size="sm" onClick={refreshBackups} disabled={loadingList} className="gap-1.5">
            {loadingList ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Atualizar lista
          </Button>
        </div>
        {backups.length ? (
          <ul className="mt-2 divide-y divide-border">
            {backups.map((backup) => (
              <li key={backup.name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span><span className="font-medium">{backup.type === "automatic" ? "Automático" : "Segurança pré-restauração"}</span> · {new Date(backup.created_at).toLocaleString("pt-BR")} · {formatBytes(backup.size)}</span>
                <a href={`/api/admin/backup?stored=${encodeURIComponent(backup.name)}`} className="font-medium text-primary hover:underline">Baixar</a>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-xs text-muted-foreground">Os backups diários aparecem aqui após a primeira execução agendada; cópias de segurança também são feitas antes de cada restauração.</p>}
      </div>
    </section>
  );
}
