import { useState } from "react";
import { Loader2, Lock, Unlock, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeEmployee, resendEmployeeInvite, setEmployeeActive } from "@/lib/team-fns";

export default function EmployeeRow({ employee, onChanged }) {
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function toggleAccess() {
    setBusy("access");
    try {
      await setEmployeeActive({ data: { id: employee.id, active: !employee.active } });
      toast.success(employee.active ? "Acesso ao painel bloqueado" : "Acesso ao painel liberado");
      await onChanged();
    } catch (error) {
      toast.error(error?.message || "Não foi possível alterar o acesso.");
    } finally {
      setBusy("");
    }
  }

  async function sendAccess() {
    setBusy("invite");
    try {
      await resendEmployeeInvite({ data: { id: employee.id } });
      toast.success(`E-mail de acesso reenviado para ${employee.email}`);
    } catch (error) {
      toast.error(error?.message || "Não foi possível reenviar o e-mail de acesso.");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await removeEmployee({ data: { id: employee.id } });
      toast.success("Funcionário removido da equipe");
      await onChanged();
    } catch (error) {
      toast.error(error?.message || "Não foi possível remover o funcionário.");
    } finally {
      setBusy("");
      setConfirming(false);
    }
  }

  return (
    <tr className="border-t border-border hover:bg-secondary/30">
      <td className="px-3 py-2">
        <p className="font-medium">{employee.name}</p>
        <p className="text-[11px] text-muted-foreground">{employee.email}</p>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{employee.phone || "—"}</td>
      <td className="px-3 py-2 text-xs">{employee.job_title || "Funcionário"}</td>
      <td className="px-3 py-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 ${employee.active ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
          {employee.active ? "Acesso ativo" : "Bloqueado"}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={toggleAccess} disabled={Boolean(busy)} className="gap-1.5">
            {busy === "access" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : employee.active ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <Unlock className="h-3.5 w-3.5" />
            )}
            {employee.active ? "Bloquear" : "Liberar"}
          </Button>
          <Button size="sm" variant="outline" onClick={sendAccess} disabled={Boolean(busy)} className="gap-1.5">
            {busy === "invite" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            Enviar acesso
          </Button>
          {confirming ? (
            <>
              <Button size="sm" variant="destructive" onClick={remove} disabled={Boolean(busy)}>
                {busy === "remove" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={Boolean(busy)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} className="gap-1.5 text-muted-foreground">
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}