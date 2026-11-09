import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/areas";

export default function SystemDiagnostics() {
  const query = useQuery({
    queryKey: ["system-diagnostics"],
    queryFn: async () => {
      const response = await fetch("/api/admin/diagnostico", { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar o diagnóstico.");
      return response.json();
    },
  });
  const info = query.data;
  return <section className="card-glass space-y-3 p-5">
    <h2 className="text-lg">Diagnóstico da instalação</h2>
    {query.isPending && <p className="text-xs">Carregando diagnóstico…</p>}
    {query.isError && <Button onClick={() => query.refetch()} variant="outline">Tentar carregar diagnóstico</Button>}
    {info && <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
      {[["Versão", info.version],
        ["Espaço livre para fotos", info.available == null ? "Indisponível" : `${(info.available / 1073741824).toFixed(1)} GB`],
        ["Último backup automático", info.lastBackup ? formatDate(info.lastBackup) : "Sem registro"],
        ["Última retenção", info.retention?.at ? formatDate(info.retention.at) : "Sem registro"],
      ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
    </dl>}
  </section>;
}
