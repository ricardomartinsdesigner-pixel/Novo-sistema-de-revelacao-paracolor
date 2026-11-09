import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useSettingsForm } from "@/hooks/use-settings-form";
import { paymentProviderSettings } from "@/lib/payment-provider-fns";

export default function PaymentRoutingSettings() {
  const { form, setForm, save, saving } = useSettingsForm((settings) => ({
    payment_routing: { enabled: false, pix: "sicoob_pix", card: "infinitepay", ...settings.payment_routing },
  }));
  const { data } = useQuery({ queryKey: ["payment-providers-admin"], queryFn: () => paymentProviderSettings() });
  if (!form) return null;
  const routing = form.payment_routing;
  function update(patch) { setForm({ payment_routing: { ...routing, ...patch } }); }
  const usable = (id) => !id || data?.providers.some((provider) => provider.id === id && provider.enabled && provider.tested
    && provider.mode === (data.sandbox ? "teste" : "producao"));
  return <section className="card-glass mt-4 space-y-3 p-4">
    <h2 className="text-lg">Provedor por forma de pagamento</h2>
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={routing.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
      Separar Pix e cartão no checkout
    </label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs">Pix
        <select value={routing.pix} onChange={(event) => update({ pix: event.target.value })} className="mt-1 block w-full rounded-lg border bg-background p-2">
          <option value="">Ocultar Pix online</option><option value="sicoob_pix">Sicoob</option>
        </select>
      </label>
      <label className="text-xs">Cartão de crédito
        <select value={routing.card} onChange={(event) => update({ card: event.target.value })} className="mt-1 block w-full rounded-lg border bg-background p-2">
          <option value="">Ocultar cartão online</option><option value="infinitepay">InfinitePay</option><option value="pagarme">Stone / Pagar.me</option>
        </select>
      </label>
    </div>
    {data && routing.enabled && (!usable(routing.pix) || !usable(routing.card)) &&
      <p className="text-xs text-amber-700">Ative e verifique os provedores selecionados para exibir as formas correspondentes.</p>}
    <p className="text-xs text-muted-foreground">A configuração vale para novas cobranças. As formas locais continuam seguindo suas regras.</p>
    <Button onClick={save} disabled={saving}>Salvar divisão por forma</Button>
  </section>;
}
