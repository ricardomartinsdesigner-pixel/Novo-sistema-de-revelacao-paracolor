import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateClientProfile } from "@/lib/account-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export default function ClientEditDialog({ client, open, onOpenChange, onSaved }) {
  const queryClient = useQueryClient();
  const update = useServerFn(updateClientProfile);
  const [form, setForm] = useState({
    full_name: "", phone: "", address: "", professional_pricing: false, allow_pickup_payment: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!client) return;
    setForm({
      full_name: client.full_name || "",
      phone: client.phone || "",
      address: client.address || "",
      professional_pricing: client.professional_pricing === true,
      allow_pickup_payment: client.professional_pricing === true && client.allow_pickup_payment === true,
    });
  }, [client, open]);

  async function save() {
    if (!form.full_name.trim()) {
      toast.warning("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    try {
      await update({ data: { ...form, id: client.id } });
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-order-client"] });
      await queryClient.invalidateQueries({ queryKey: ["shop-professional-pricing"] });
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
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar cadastro do cliente</DialogTitle>
          <DialogDescription>
            Edite os dados de atendimento, a tabela de revelação e as permissões de pagamento do cliente.
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
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="professional-pricing">Preço especial para fotógrafo</Label>
                <p className="mt-1 text-xs text-muted-foreground">Usa a tabela profissional publicada em Preços.</p>
              </div>
              <Switch
                id="professional-pricing"
                checked={form.professional_pricing}
                onCheckedChange={(checked) => setForm((current) => ({
                  ...current,
                  professional_pricing: checked,
                  allow_pickup_payment: checked && current.allow_pickup_payment,
                }))}
              />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="pickup-payment">Autorizar pagamento na retirada</Label>
                <p className="mt-1 text-xs text-muted-foreground">O fotógrafo pode escolher pagar no balcão ao buscar o pedido.</p>
              </div>
              <Switch
                id="pickup-payment"
                disabled={!form.professional_pricing}
                checked={form.allow_pickup_payment}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, allow_pickup_payment: checked }))}
              />
            </div>
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
