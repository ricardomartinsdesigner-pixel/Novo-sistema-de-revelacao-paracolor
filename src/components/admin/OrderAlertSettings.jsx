import { useEffect, useRef, useState } from "react";
import { BellRing, Loader2, Volume2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/store";
import { createOrderAlertAudio, ORDER_SOUND_STYLES, playOrderAlertSound } from "@/lib/order-alert-sounds";

export default function OrderAlertSettings() {
  const { settings, isLoading } = useSettings();
  const queryClient = useQueryClient();
  const audioRef = useRef(null);
  const [style, setStyle] = useState("bip_curto");
  const [saving, setSaving] = useState(false);
  const savedStyle = settings?.order_sound_style || "bip_curto";

  useEffect(() => {
    setStyle(savedStyle);
  }, [savedStyle]);

  useEffect(() => () => {
    if (audioRef.current && audioRef.current.state !== "closed") void audioRef.current.close().catch(() => {});
  }, []);

  async function preview() {
    const audio = audioRef.current || createOrderAlertAudio();
    audioRef.current = audio;
    if (!audio) {
      toast.error("Este navegador não disponibiliza áudio para a prévia.");
      return;
    }
    try {
      await audio.resume();
      playOrderAlertSound(audio, style, 1);
    } catch {
      toast.error("Não foi possível reproduzir a prévia do som.");
    }
  }

  async function save() {
    if (!settings?.id) return;
    setSaving(true);
    try {
      await base44.entities.Settings.update(settings.id, { order_sound_style: style });
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Som dos avisos salvo");
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar o som dos avisos.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !settings) return null;

  const selected = ORDER_SOUND_STYLES.find((option) => option.value === style) || ORDER_SOUND_STYLES[0];
  return (
    <section className="card-glass p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-foreground">
          <BellRing className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg">Avisos de novos pedidos</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Escolha o som que será usado nos pedidos novos. A preferência vale para toda a equipe; cada pessoa pode ligar ou desligar o próprio áudio no topo do painel.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="text-xs text-muted-foreground">
          Estilo do aviso sonoro
          <select
            value={style}
            onChange={(event) => setStyle(event.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {ORDER_SOUND_STYLES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <span className="mt-1 block text-[11px]">{selected.description}</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={preview}>
            <Volume2 className="mr-1.5 h-4 w-4" /> Ouvir prévia
          </Button>
          <Button type="button" onClick={save} disabled={saving || style === savedStyle}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Salvar som
          </Button>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Os alertas chegam em tempo real enquanto o painel estiver aberto. Alguns navegadores exigem um clique no painel para liberar o áudio.
      </p>
    </section>
  );
}
