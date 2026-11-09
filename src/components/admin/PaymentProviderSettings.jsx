import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { paymentProviderSettings, savePaymentProvider, testPaymentProvider } from "@/lib/payment-provider-fns";
import { PAYMENT_PROVIDERS, SICOOB_ENDPOINTS } from "@/lib/payment-providers";

function ProviderForm({ provider, settings, onSaved }) {
  const [enabled, setEnabled] = useState(provider.enabled);
  const [mode, setMode] = useState(provider.mode);
  const [priority, setPriority] = useState(provider.priority);
  const [credentials, setCredentials] = useState({});
  const set = (key, value) => setCredentials((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () => savePaymentProvider({ data: { id: provider.id, enabled, mode, priority: Number(priority), credentials } }),
    onSuccess: () => { setCredentials({}); toast.success("Configuração salva."); void onSaved(); },
    onError: (error) => toast.error(error.message),
  });
  const test = useMutation({
    mutationFn: () => testPaymentProvider({ data: { id: provider.id } }),
    onSuccess: ({ message }) => { toast.success(message, { duration: 8500 }); void onSaved(); },
    onError: (error) => toast.error(error.message),
  });
  const busy = save.isPending || test.isPending;
  const field = (name, label, secret = false) => <label className="block text-sm" key={name}>{label}
    <Input type={secret ? "password" : "text"} autoComplete="new-password" value={credentials[name] ?? ""}
      placeholder={provider.configured && mode === provider.mode ? "Manter o valor salvo" : ""}
      onChange={(event) => set(name, event.target.value)} />
  </label>;
  const pem = (name, label) => <label className="block text-sm" key={name}>{label}
    <textarea autoComplete="off" spellCheck={false} rows={3} value={credentials[name] ?? ""}
      placeholder={provider.configured && mode === provider.mode ? "Manter o valor salvo" : ""}
      onChange={(event) => set(name, event.target.value)}
      className="block w-full rounded-md border border-input bg-background p-2 font-mono text-xs" />
  </label>;
  const endpoint = (name, label, values) => <label className="block text-sm" key={name}>{label}
    <select aria-label={label} value={credentials[name] ?? ""} onChange={(event) => set(name, event.target.value)}
      className="block w-full rounded-md border border-input bg-background p-2 text-xs">
      <option value="">{provider.configured && mode === provider.mode ? "Manter o endereço salvo" : "Selecione conforme a cooperativa"}</option>
      {values.map((url) => <option key={url} value={url}>{url}</option>)}
    </select>
  </label>;

  return <form className="space-y-3 rounded-xl border border-border bg-card p-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
    <h3 className="font-medium">{PAYMENT_PROVIDERS[provider.id].label}</h3>
    <p className="text-xs text-muted-foreground">
      {provider.configured ? "Credenciais salvas" : "Aguardando credenciais"} · {provider.tested ? "Configuração verificada" : "Verificação pendente"}
    </p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">Ambiente
        <select aria-label="Ambiente" value={mode} onChange={(event) => { setMode(event.target.value); setCredentials({}); setEnabled(false); }}
          disabled={provider.id === "infinitepay"} className="block h-10 w-full rounded-md border border-input bg-background px-2">
          <option value="teste">Homologação</option><option value="producao">Produção</option>
        </select>
      </label>
      <label className="block text-sm">Prioridade no checkout
        <Input type="number" min="1" max="999" required value={priority} onChange={(event) => setPriority(event.target.value)} />
      </label>
    </div>
    {provider.id === "sicoob_pix" ? <div className="grid gap-3 sm:grid-cols-2">
      {field("clientId", "Client ID")}{field("clientSecret", "Client Secret (se fornecido)", true)}
      {field("pixKey", "Chave Pix da conta")}{field("passphrase", "Senha da chave privada (se houver)", true)}
      {pem("certificate", "Certificado PEM")}{pem("privateKey", "Chave privada PEM")}
      {endpoint("tokenUrl", "Endereço OAuth", SICOOB_ENDPOINTS.token[mode])}
      {endpoint("apiUrl", "Endereço da API Pix", SICOOB_ENDPOINTS.api[mode])}
    </div> : <div className="grid gap-3 sm:grid-cols-2">
      {field("apiKey", provider.id === "infinitepay" ? "API Key do Checkout Integrado" : "Chave secreta", true)}
      {provider.id === "infinitepay" && field("handle", "InfiniteTag sem cifrão")}
    </div>}
    {provider.id === "infinitepay" && <p className="text-xs text-muted-foreground">A verificação deste provedor é local. A API confirma a chave ao abrir a primeira cobrança.</p>}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Ativar para novas cobranças</label>
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" disabled={busy || !settings.keyConfigured}>Salvar</Button>
      <Button type="button" size="sm" variant="outline" disabled={busy || !provider.configured || !settings.keyConfigured}
        onClick={() => test.mutate()}>Verificar configuração</Button>
    </div>
  </form>;
}

export default function PaymentProviderSettings() {
  const client = useQueryClient();
  const result = useQuery({ queryKey: ["payment-providers-admin"], queryFn: () => paymentProviderSettings() });
  const settings = result.data;
  return <section className="mt-4 space-y-3">
    <h2 className="text-lg font-medium">Integrações de pagamento</h2>
    <p className="text-sm text-muted-foreground">Salve as credenciais com o provedor desativado, verifique a configuração e só então habilite. Número menor aparece primeiro.</p>
    {result.isPending && <p className="text-sm">Carregando integrações…</p>}
    {result.isError && <Button size="sm" variant="outline" onClick={() => result.refetch()}>Tentar carregar novamente</Button>}
    {settings && <>
      {!settings.keyConfigured && <p className="rounded-lg border border-gold p-3 text-sm">Configure SECURITY_SECRETS_KEY no servidor para habilitar as credenciais e a autenticação em duas etapas.</p>}
      {settings.sandbox && <p className="rounded-lg border border-gold p-3 text-sm">Ambiente de homologação. Pedidos de teste não são liberados para produção.</p>}
      <div className="grid gap-3 xl:grid-cols-2">
        {settings.providers.map((provider) => <ProviderForm key={provider.id} provider={provider} settings={settings}
          onSaved={() => Promise.all([result.refetch(), client.invalidateQueries({ queryKey: ["checkout-quote"] })])} />)}
      </div>
      {settings.callback && <div className="rounded-xl border border-border p-4">
        <h3 className="font-medium">Notificações da Stone / Pagar.me</h3>
        <p className="mt-1 text-sm text-muted-foreground">Cadastre a URL no painel do Pagar.me para os eventos de pedido pago, cancelado, atualizado e pagamento recusado.</p>
        <Input className="mt-2 font-mono text-xs" readOnly aria-label="URL privada do webhook Pagar.me" value={settings.callback} onFocus={(event) => event.target.select()} />
      </div>}
      <p className="text-xs text-muted-foreground">Para cartão Sipag, peça o produto de e-commerce e as credenciais da sua cooperativa.</p>
    </>}
  </section>;
}
