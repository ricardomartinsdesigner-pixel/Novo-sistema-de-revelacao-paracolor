import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

async function loadAnalytics() {
  const response = await fetch("/api/admin/site-analytics", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível carregar as visitas.");
  return response.json();
}

function Metric({ label, value, detail, live = false }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        {live && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />}
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function SiteAnalyticsPanel() {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const { data, isPending, isError } = useQuery({
    queryKey: ["admin-site-analytics"],
    queryFn: loadAnalytics,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
  useEffect(() => {
    const stream = new EventSource("/api/admin/site-analytics?stream=1");
    stream.onopen = () => {
      setLive(true);
      void queryClient.invalidateQueries({ queryKey: ["admin-site-analytics"] });
    };
    stream.onmessage = (event) => {
      try {
        queryClient.setQueryData(["admin-site-analytics"], JSON.parse(event.data));
        setLive(true);
      } catch { /* ignora um evento incompleto e mantém o último total válido */ }
    };
    stream.onerror = () => setLive(false);
    return () => stream.close();
  }, [queryClient]);
  const number = (value) => isPending ? "—" : new Intl.NumberFormat("pt-BR").format(Number(value) || 0);

  return (
    <section className="mt-6 border border-border bg-card/60 p-4 sm:p-5" aria-labelledby="site-analytics-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">Acompanhamento em tempo real</p>
          <h2 id="site-analytics-title" className="mt-1 text-xl">Visitas ao site</h2>
        </div>
        <p className={`inline-flex items-center gap-2 text-xs ${live ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
          <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/50"}`} aria-hidden="true" />
          {live ? "Conectado · atualizando ao vivo" : "Conectando à atualização ao vivo…"}
        </p>
      </div>
      {isError ? (
        <p role="status" className="mt-4 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Não foi possível carregar os dados de visitas.
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <Metric live label="Online agora" value={number(data?.online_now)} detail="Atividade nos últimos 75 segundos" />
        <Metric label="Visitantes hoje" value={number(data?.today_visitors)} detail="Navegadores únicos hoje" />
        <Metric label="Visualizações hoje" value={number(data?.today_pageviews)} detail="Páginas abertas hoje" />
        <Metric label={`Visitantes nos últimos ${data?.retention_days ?? 400} dias`} value={number(data?.total_visitors)} detail="Navegadores únicos no período armazenado" />
        <Metric label={`Visualizações nos últimos ${data?.retention_days ?? 400} dias`} value={number(data?.total_pageviews)} detail="Páginas abertas no período armazenado" />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        A contagem usa um identificador aleatório salvo no navegador e não inclui visitas de administradores ou equipe.
      </p>
    </section>
  );
}
