import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getIntegrations, saveIntegrations, testMercadoPago } from "@/lib/integrations-fns";

const inputClass = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";

export default function MercadoPagoConfig() {
  const queryClient = useQueryClient();
  const load = useServerFn(getIntegrations);
  const save = useServerFn(saveIntegrations);
  const test = useServerFn(testMercadoPago);
  const [token, setToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data } = useQuery({ queryKey: ["integrations"], queryFn: () => load() });
  const mp = data?.mercadopago;

  useEffect(() => {
    if (mp) setEnabled(mp.enabled);
  }, [mp]);

  const mutation = useMutation({
    mutationFn: () => save({ data: { mercadopago: { enabled, token, webhook_secret: webhookSecret } } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      setToken("");
      setWebhookSecret("");
      toast.success("Credenciais do Mercado Pago salvas");
    },
    onError: (error) => toast.error(error.message || "Não foi possível salvar."),
  });

  async function runTest() {
    setTesting(true);
    try {
      const result = await test();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    } catch (error) {
      toast.error(error.message || "Não foi possível testar a conexão.");
    } finally {
      setTesting(false);
    }
  }

  const active = Boolean(mp?.configured && mp?.enabled);

  return (
    <section className={`rounded-xl border p-4 ${active ? "border-border bg-card" : "border-amber-300 bg-amber-50"}`}>
      <div className="flex items-start gap-3">
        <CreditCard className="mt-0.5 h-4 w-4" />
        <div className="flex-1">
          <p className="font-medium">Mercado Pago</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {active
              ? `Checkout online ativo · credencial de ${mp.payment_mode}. O pedido só é aprovado após confirmação autenticada do webhook.`
              : "Checkout online inativo. Cadastre o Access Token, a chave secreta do webhook e ative a integração."}
          </p>
          {mp?.account ? <p className="mt-1 text-[11px] text-muted-foreground">Conta conectada: {mp.account}</p> : null}
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Access Token {mp?.token_hint ? <span className="text-foreground">(salvo: {mp.token_hint})</span> : null}
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="APP_USR-..."
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Chave secreta do Webhook {mp?.webhook_secret_hint ? <span className="text-foreground">(salva: {mp.webhook_secret_hint})</span> : null}
          <input type="password" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="Cole a chave de Webhooks do painel Mercado Pago" autoComplete="off" className={inputClass} />
        </label>
        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={runTest} disabled={testing || !mp?.configured}>
            {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PlugZap className="mr-1.5 h-3.5 w-3.5" />}
            Testar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Salvar
          </Button>
        </div>
      </div>
      <p className="mt-2 break-all text-[11px] text-muted-foreground">
        No Mercado Pago, copie o Access Token e a chave secreta em Suas integrações → sua aplicação → Webhooks. Configure o evento <strong>Pagamentos</strong> para {mp?.webhook_url || "/api/mercadopago-webhook"}. O servidor valida a assinatura e consulta o pagamento antes de aprovar o pedido.
      </p>
    </section>
  );
}
