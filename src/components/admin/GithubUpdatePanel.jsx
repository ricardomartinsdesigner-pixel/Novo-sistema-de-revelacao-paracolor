import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { checkGithubUpdate, installGithubUpdate } from "@/lib/github-updates-fns";

export default function GithubUpdatePanel() {
  const check = useServerFn(checkGithubUpdate);
  const install = useServerFn(installGithubUpdate);
  const [release, setRelease] = useState(null);
  const checkMutation = useMutation({
    mutationFn: () => check(),
    onSuccess: (result) => {
      setRelease(result);
      toast.success(result.available ? `Atualização ${result.version} encontrada.` : "O sistema já está atualizado.");
    },
    onError: (error) => toast.error(error.message || "Não foi possível consultar o GitHub."),
  });
  const installMutation = useMutation({
    mutationFn: () => install({ data: { version: release.version } }),
    onSuccess: () => toast.success("Pacote verificado e instalado. O servidor será reiniciado automaticamente."),
    onError: (error) => toast.error(error.message || "Não foi possível instalar a atualização."),
  });

  return (
    <section className="card-glass p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <RefreshCw className="mt-1 h-4 w-4" />
          <div>
            <h2 className="text-lg">Atualizações do sistema</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Consulte a versão publicada no GitHub. A instalação valida o checksum, mantém uma cópia anterior e reinicia o serviço.
            </p>
            {release ? (
              <p className="mt-2 text-sm">
                Instalado: <strong>{release.current_version}</strong> · GitHub: <strong>{release.version}</strong> · {release.available ? "atualização disponível" : "sem atualização"}
              </p>
            ) : null}
            {release?.notes ? <p className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{release.notes}</p> : null}
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> O painel aplica somente builds publicados como Release neste repositório.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => checkMutation.mutate()} disabled={checkMutation.isPending || installMutation.isPending}>
            {checkMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Buscar atualização
          </Button>
          {release?.available ? (
            <Button onClick={() => installMutation.mutate()} disabled={checkMutation.isPending || installMutation.isPending}>
              {installMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
              Instalar {release.version}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
