import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ClientEditDialog({ client, open, onOpenChange, onSaved }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!client) return;
    setForm({
      full_name: client.full_name || "",
      phone: client.phone || "",
      address: client.address || "",
    });
  }, [client, open]);

  async function save() {
    if (!form.full_name.trim()) {
      toast.warning("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.User.update(client.id, {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-order-client"] });
      toast.success("Cadastro atualizado");
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar o cadastro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar cadastro do cliente</DialogTitle>
          <DialogDescription>
            Corrija nome, telefone e endereço usados no atendimento. O e-mail de acesso não pode ser alterado por aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="client-name">Nome completo</Label>
            <Input
              id="client-name"
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              placeholder="Nome e sobrenome"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-email">E-mail (não editável)</Label>
            <Input id="client-email" value={client?.email || ""} readOnly disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-phone">Telefone / WhatsApp</Label>
            <Input
              id="client-phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-address">Endereço cadastrado</Label>
            <Textarea
              id="client-address"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              rows={3}
              placeholder="Rua, número, bairro, cidade e CEP"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Salvar cadastro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}