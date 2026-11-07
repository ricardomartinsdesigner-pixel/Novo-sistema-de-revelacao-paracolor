import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { processAccountDeletion } from "@/lib/account-fns";
import { formatDate } from "@/lib/areas";

export default function DeletionRequestsPanel() {
  const queryClient = useQueryClient();
  const process = useServerFn(processAccountDeletion);
  const [target, setTarget] = useState(null);
  const [note, setNote] = useState("");

  const { data: requests = [] } = useQuery({
    queryKey: ["deletion-requests"],
    queryFn: async () =>
      (await base44.entities.AccountDeletionRequest.filter({ status: "pendente" }, { sort: "created_date", limit: 50 })).items ?? [],
  });

  const mutation = useMutation({
    mutationFn: ({ request, action }) => process({ data: { request_id: request.id, action, note: note.trim() } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
      if (result.status === "processado") {
        toast.success(
          `Dados apagados: ${result.orders} pedido(s) e ${result.photos} foto(s). Remova o acesso de ${result.user_email} em App Users.`
        );
      } else {
        toast.success("Solicitação recusada.");
      }
      setTarget(null);
      setNote("");
    },
    onError: (error) => toast.error(error?.message || "Não foi possível processar a solicitação."),
  });

  if (!requests.length) return null;

  return (
    <section className="mt-6 rounded-xl border border-destructive/30 bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldAlert className="h-4 w-4 text-destructive" /> Solicitações de exclusão ({requests.length})
      </h2>
      <ul className="mt-3 space-y-2">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{request.user_name || "Cliente"}</p>
              <p className="text-[11px] text-muted-foreground">
                {request.user_email} · pedido em {formatDate(request.requested_at || request.created_date)}
              </p>
              {request.reason ? <p className="mt-1 text-[11px] text-muted-foreground">“{request.reason}”</p> : null}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => { setNote(""); mutation.mutate({ request, action: "recusar" }); }}>
                Recusar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { setNote(""); setTarget(request); }}>
                Processar exclusão
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={Boolean(target)} onOpenChange={(open) => (open ? null : setTarget(null))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Apagar os dados de {target?.user_name || target?.user_email}</DialogTitle>
            <DialogDescription>
              Os pedidos ficam registrados sem nome, e-mail, telefone, CPF e endereço. As fotos enviadas são excluídas.
              O acesso do cliente precisa ser removido em App Users.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={600}
            placeholder="Observação interna (opcional)"
            className="text-sm"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTarget(null)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="gap-1.5"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ request: target, action: "processar" })}
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Apagar dados
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}