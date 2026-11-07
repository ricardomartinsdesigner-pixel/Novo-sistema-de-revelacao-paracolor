import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PlugZap, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getIntegrations, saveIntegrations, testMelhorEnvio } from "@/lib/integrations-fns";

const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

export default function MelhorEnvioConfig() {
  const queryClient = useQueryClient();
  const load = useServerFn(getIntegrations);
  const save = useServerFn(saveIntegrations);
  const test = useServerFn(testMelhorEnvio);
  const [form, setForm] = useState({ token: "", enabled: false, sandbox: true, from_cep: "", contact_email: "", package_width: 22, package_height: 6, package_length: 30, package_weight: 0.4 });
  const [testing, setTesting] = useState(false);

  const { data } = useQuery({ queryKey: ["integrations"], queryFn: () => load() });
  const me = data?.melhor_envio;

  useEffect(() => {
    if (me) setForm((current) => ({ ...current, enabled: me.enabled, sandbox: me.sandbox, from_cep: me.from_cep, contact_email: me.contact_email, package_width: me.package_width, package_height: me.package_height, package_length: me.package_length, package_weight: me.package_weight }));
  }, [me]);

  const mutation = useMutation({
    mutationFn: () => save({ data: { melhor_envio: form } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      setForm((current) => ({ ...current, token: "" }));
      toast.success("Credenciais do Melhor Envio salvas");
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

  return (
    <section className="card-glass p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Truck className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">Melhor Envio</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {me?.configured
                ? `Token cadastrado${me.token_hint ? ` (${me.token_hint})` : ""} · ambiente ${me.sandbox ? "sandbox" : "produção"}.`
                : "Cadastre o token e os dados do pacote para cotar fretes. Esta integração não compra nem gera etiquetas."}
            </p>
            {me?.account ? <p className="mt-1 text-[11px] text-muted-foreground">Conta conectada: {me.account}</p> : null}
          </div>
        </div>
        <Switch checked={form.enabled} onCheckedChange={(checked) => setForm({ ...form, enabled: checked })} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Token de acesso
          <input
            type="password"
            value={form.token}
            onChange={(event) => setForm({ ...form, token: event.target.value })}
            placeholder="Cole aqui o token do Melhor Envio"
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          CEP de origem dos envios
          <input
            value={form.from_cep}
            onChange={(event) => setForm({ ...form, from_cep: event.target.value })}
            placeholder="00000-000"
            className={inputClass}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          E-mail de contato cadastrado no Melhor Envio
          <input type="email" value={form.contact_email} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} placeholder="seu-email@dominio.com.br" className={inputClass} />
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[
          ["package_width", "Largura (cm)"], ["package_height", "Altura (cm)"],
          ["package_length", "Comprimento (cm)"], ["package_weight", "Peso (kg)"],
        ].map(([key, label]) => (
          <label key={key} className="text-xs text-muted-foreground">
            {label}
            <input type="number" min="0.01" step="0.01" value={form[key]} onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })} className={inputClass} />
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={form.sandbox} onCheckedChange={(checked) => setForm({ ...form, sandbox: checked })} />
          Usar ambiente sandbox (testes)
        </label>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runTest} disabled={testing || !me?.configured}>
            {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PlugZap className="mr-1.5 h-3.5 w-3.5" />}
            Testar conexão
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Salvar
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Informe token, CEP de origem, contato e medidas/peso médios do pacote. O sistema consulta cotações; compra e impressão de etiquetas exigem dados de destinatário e ainda não fazem parte deste fluxo. Gere o token em Melhor Envio → Integrações → Tokens.
      </p>
    </section>
  );
}
