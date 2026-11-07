import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestAccountDeletion } from "@/lib/account-fns";
import { formatDate } from "@/lib/areas";

const CONFIRM_WORD = "EXCLUIR";

export default function DeleteAccountCard({ user }) {
  const queryClient = useQueryClient();
  const submitRequest = useServerFn(requestAccountDeletion);
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [word, setWord] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  const { data: lastRequest = null } = useQuery({
    queryKey: ["account-deletion", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const page = await base44.entities.AccountDeletionRequest.filter(
        { created_by_id: user.id },
        { sort: "-created_date", limit: 1 }
      );
      return (page.items ?? [])[0] ?? null;
    },
  });

  const pending = lastRequest?.status === "pendente";
  const ready = ack && word.trim().toUpperCase() === CONFIRM_WORD;

  function close() {
    setOpen(false);
    setAck(false);
    setWord("");
    setReason("");
  }

  async function send() {
    if (!ready || sending) return;
    setSending(true);
    try {
      await submitRequest({ data: { confirm: word.trim(), reason: reason.trim() } });
      await queryClient.invalidateQueries({ queryKey: ["account-deletion", user.id] });
      toast.success("Solicitação enviada. Nossa equipe vai processar em até 5 dias úteis.");
      close();
    } catch (error) {
      toast.error(error?.message || "Não foi possível enviar a solicitação.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-[1.25rem] border border-destructive/30 bg-card p-6">
      <h2 className="flex items-center gap-2 text-lg">
        <ShieldAlert className="h-4 w-4 text-destructive" /> Excluir minha conta
      </h2>
      {pending ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Solicitação enviada em {formatDate(lastRequest.requested_at || lastRequest.created_date)}. Nossa equipe vai
          apagar seus dados e encerrar sua conta. Se mudar de ideia, fale com a loja antes disso.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            Pede a exclusão definitiva da sua conta e dos seus dados pessoais — contato, endereço e fotos enviadas.
          </p>
          <Button
            variant="outline"
            onClick={() => setOpen(true)}
            className="mt-4 w-full gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Solicitar exclusão
          </Button>
        </>
      )}

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão da conta</DialogTitle>
            <DialogDescription>Esta ação é definitiva e não pode ser desfeita.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Seus dados de contato e endereço serão apagados.</li>
              <li>As fotos enviadas nos seus pedidos serão excluídas.</li>
              <li>Seus pedidos continuam registrados sem seus dados, apenas para fins fiscais.</li>
              <li>Sua conta de acesso será encerrada e você não poderá entrar novamente.</li>
            </ul>

            <label className="flex items-start gap-2 text-xs">
              <Checkbox checked={ack} onCheckedChange={(value) => setAck(Boolean(value))} className="mt-0.5" />
              <span>Entendi que a exclusão é definitiva.</span>
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="delete-word" className="text-xs">
                Para confirmar, digite {CONFIRM_WORD}
              </Label>
              <Input
                id="delete-word"
                value={word}
                onChange={(event) => setWord(event.target.value)}
                autoComplete="off"
                placeholder={CONFIRM_WORD}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delete-reason" className="text-xs">
                Motivo (opcional)
              </Label>
              <Textarea
                id="delete-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                maxLength={600}
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={sending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={send} disabled={!ready || sending} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Enviar solicitação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}