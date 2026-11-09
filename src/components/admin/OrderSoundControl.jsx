import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/store";
import { createOrderAlertAudio, playOrderAlertSound } from "@/lib/order-alert-sounds";

const ALERT_KEY = "paracolor.order-alerts.v1";
const SOUND_ENABLED_KEY = "paracolor.order-sound.enabled.v1";

function readEnabled() {
  try { return localStorage.getItem(SOUND_ENABLED_KEY) !== "false"; }
  catch { return true; }
}

async function announceAlerts(ids, seen, audio, style, isCurrent) {
  if (!ids.length) return;
  function announce() {
    if (!isCurrent() || audio?.state !== "running") return false;
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(ALERT_KEY) || "[]"); }
    catch { /* armazenamento privado */ }
    const previous = new Set(Array.isArray(stored) ? stored : []);
    const fresh = [...new Set(ids)].filter((id) => !seen.has(id) && !previous.has(id));
    if (fresh.length) {
      playOrderAlertSound(audio, style, fresh.length);
      try { localStorage.setItem(ALERT_KEY, JSON.stringify([...previous, ...fresh].slice(-1000))); }
      catch { /* armazenamento privado */ }
    }
    ids.forEach((id) => seen.add(id));
    return true;
  }
  if (navigator.locks) return navigator.locks.request(ALERT_KEY, announce);
  return announce();
}

export default function OrderSoundControl() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const audioRef = useRef(null);
  const seenRef = useRef(new Set());
  const queuedRef = useRef(new Set());
  const pendingRef = useRef(new Set());
  const timerRef = useRef(null);
  const enabledRef = useRef(true);
  const styleRef = useRef("bip_curto");
  const [enabled, setEnabled] = useState(readEnabled);
  const [audioState, setAudioState] = useState("suspended");
  const [retrying, setRetrying] = useState(false);

  enabledRef.current = enabled;
  styleRef.current = settings?.order_sound_style || "bip_curto";

  useEffect(() => {
    const audio = createOrderAlertAudio();
    audioRef.current = audio;
    const seen = seenRef.current;
    const queued = queuedRef.current;
    const pending = pendingRef.current;
    let active = true;
    let source;
    let retryTimer;

    function flush(ids) {
      const unique = [...new Set(ids)].filter((id) => !seen.has(id));
      if (!unique.length) return;
      if (!enabledRef.current) {
        unique.forEach((id) => seen.add(id));
        return;
      }
      if (audio?.state !== "running") {
        unique.forEach((id) => pending.add(id));
        return;
      }
      void announceAlerts(unique, seen, audio, styleRef.current, () => active && enabledRef.current)
        .then((announced) => {
          if (!announced && active && enabledRef.current) unique.forEach((id) => pending.add(id));
        });
    }

    function drain() {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const ids = [...queued];
      queued.clear();
      ids.forEach((id) => pending.delete(id));
      flush(ids);
    }

    function queueAlert(id) {
      if (!id || seen.has(id) || queued.has(id) || pending.has(id)) return;
      if (!enabledRef.current) {
        seen.add(id);
        return;
      }
      queued.add(id);
      if (!timerRef.current) timerRef.current = setTimeout(drain, 120);
    }

    function unlock() {
      if (audio && enabledRef.current && audio.state !== "running" && audio.state !== "closed") {
        void audio.resume().catch(() => {});
      }
    }

    function updateAudioState() {
      setAudioState(audio?.state || "unavailable");
      if (audio?.state === "running" && pending.size) {
        const ids = [...pending];
        pending.clear();
        flush(ids);
      }
    }

    async function connect() {
      try {
        const response = await fetch("/api/admin/order-alerts", { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao iniciar os avisos.");
        const { cutoff } = await response.json();
        if (!active) return;
        const params = new URLSearchParams({ after: cutoff });
        params.set("stream", "1");
        source = new EventSource(`/api/admin/order-alerts?${params}`);
        source.onopen = () => { if (active) setRetrying(false); };
        source.onmessage = (event) => {
          if (!active) return;
          let payload;
          try { payload = JSON.parse(event.data); } catch { return; }
          const ids = [...new Set([...(payload.ids || []), ...(payload.id ? [payload.id] : [])].map(String).filter(Boolean))];
          if (!ids.length) return;
          void queryClient.invalidateQueries({ queryKey: ["admin-unread-order-alerts"] });
          void queryClient.invalidateQueries({ queryKey: ["admin-new-orders"] });
          void queryClient.invalidateQueries({ queryKey: ["Order", "admin-pages"] });
          window.dispatchEvent(new CustomEvent("paracolor:order-alert", { detail: { ids } }));
          ids.forEach(queueAlert);
        };
        source.onerror = () => { if (active) setRetrying(true); };
      } catch {
        if (!active) return;
        setRetrying(true);
        retryTimer = setTimeout(connect, 5000);
      }
    }

    audio?.addEventListener("statechange", updateAudioState);
    window.addEventListener("click", unlock, true);
    window.addEventListener("keydown", unlock, true);
    updateAudioState();
    unlock();
    void connect();

    return () => {
      active = false;
      clearTimeout(timerRef.current);
      clearTimeout(retryTimer);
      source?.close();
      window.removeEventListener("click", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      audio?.removeEventListener("statechange", updateAudioState);
      audioRef.current = null;
      if (audio && audio.state !== "closed") void audio.close().catch(() => {});
    };
  }, [queryClient]);

  function toggleSound() {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(SOUND_ENABLED_KEY, String(next)); } catch { /* armazenamento privado */ }
    if (next) {
      const audio = audioRef.current;
      if (audio && audio.state !== "running" && audio.state !== "closed") void audio.resume().catch(() => {});
    } else {
      const ids = [...queuedRef.current, ...pendingRef.current];
      ids.forEach((id) => seenRef.current.add(id));
      queuedRef.current.clear();
      pendingRef.current.clear();
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function unlockAudio() {
    const audio = audioRef.current;
    if (audio && audio.state !== "running" && audio.state !== "closed") void audio.resume().catch(() => {});
  }

  const needsInteraction = enabled && audioState !== "running" && audioState !== "unavailable";
  const Icon = enabled ? Volume2 : VolumeX;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
      {enabled ? (
        <p role="status" className="text-xs text-muted-foreground">
          {audioState === "unavailable" ? "Áudio indisponível neste navegador."
            : needsInteraction ? "Som ligado. Clique ou toque no painel para liberar o bip."
            : retrying ? "Reconectando aos avisos de pedidos em tempo real…" : "Avisos de pedidos em tempo real ligados"}
        </p>
      ) : <p className="text-xs text-muted-foreground">Avisos sonoros desativados</p>}
      {needsInteraction ? (
        <Button type="button" size="sm" variant="outline" onClick={unlockAudio}>
          Liberar áudio
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="outline" aria-pressed={enabled} onClick={toggleSound}>
        <Icon className="mr-1.5 h-4 w-4" />
        {enabled ? "Desativar som de pedidos" : "Ativar som de pedidos"}
      </Button>
    </div>
  );
}
