import { useSettingsForm } from "@/hooks/use-settings-form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function StorePaymentSettings() {
  const { settings, form, setForm, save, saving, isLoading } = useSettingsForm((current) => ({
    allow_store_payment: current.allow_store_payment !== false,
  }));

  if (isLoading || !settings || !form) return null;
  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h2 className="font-medium">Pagamento na loja</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Esta é a regra geral para clientes comuns. Para liberar pagamento na retirada a um fotógrafo, use a autorização individual em Clientes.
          </p>
        </div>
        <Switch
          checked={form.allow_store_payment}
          onCheckedChange={(checked) => setForm({ ...form, allow_store_payment: checked })}
          aria-label="Permitir combinar o pagamento na loja"
        />
      </div>
      <Button className="mt-3" size="sm" onClick={save} disabled={saving || form.allow_store_payment === (settings.allow_store_payment !== false)}>
        {saving ? "Salvando…" : "Salvar preferência"}
      </Button>
    </section>
  );
}
