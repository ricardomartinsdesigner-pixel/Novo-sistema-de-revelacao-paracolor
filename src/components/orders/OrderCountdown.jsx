import { useEffect, useState } from "react";

function remaining(target, now) {
  const diff = Math.max(0, target - now);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Contagem regressiva do prazo rápido (1 hora / 1 dia / 2 dias). */
export default function OrderCountdown({ dueAt, className = "" }) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const target = dueAt ? new Date(dueAt).getTime() : NaN;
  if (Number.isNaN(target)) return null;

  if (now === null) return <span className={`tabular-nums ${className}`}>--:--:--</span>;
  if (target <= now) return <span className={className}>Prazo encerrado</span>;

  return <span className={`tabular-nums ${className}`}>{remaining(target, now)}</span>;
}