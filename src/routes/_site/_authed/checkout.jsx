import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import CheckoutField from "@/components/checkout/CheckoutField";
import CheckoutSummary from "@/components/checkout/CheckoutSummary";
import PickupNotice from "@/components/checkout/PickupNotice";
import ShippingOptions from "@/components/checkout/ShippingOptions";
import useCheckout from "@/hooks/use-checkout";
import { useCart } from "@/lib/cart";
import { useSettings } from "@/lib/store";
import { useAuth } from "@/lib/AuthContext";
import { formatBRL } from "@/lib/areas";
import { deadlineFor } from "@/lib/deadline";

export const Route = createFileRoute("/_site/_authed/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Paracolor" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, ready } = useCart();

  const { settings, isLoading: settingsLoading } = useSettings();
  const { user } = useAuth();
  const [form, setForm] = useState({
    customer_name: user?.full_name || "",
    customer_email: user?.email || "",
    customer_phone: user?.phone || "",
    customer_cpf: "",
    fulfillment: "retirada",
    shipping_cep: "",
    shipping_address: user?.address || "",
    gift_message: "",
    payment_method: "retirada",
  });
  const [coupon, setCoupon] = useState("");
  const [approval, setApproval] = useState("sim");

  // Perfil carregado depois da página: completa o que ainda estiver vazio sem
  // apagar o que o cliente já digitou.
  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      customer_name: current.customer_name || user.full_name || "",
      customer_email: current.customer_email || user.email || "",
      customer_phone: current.customer_phone || user.phone || "",
      shipping_address: current.shipping_address || user.address || "",
    }));
  }, [user]);
  const [cepStatus, setCepStatus] = useState("idle");
  const readyDate = useMemo(
    () => (settings ? deadlineFor(settings, items.map((item) => item.area)) : null),
    [settings, items]
  );
  const { quote, calculating, error, submitting, submit } = useCheckout(form, coupon, approval);
  const needsApproval = items.some((item) => item.options?.art_approval_mode && item.options.art_approval_mode !== "desativada");
  // Entrega só aparece quando a loja habilita o frete no painel.
  const shippingAvailable = Boolean(settings?.shipping_enabled || settings?.shipping_quote_enabled);
  const mandatoryApproval = items.some((item) => item.options?.art_approval_mode === "obrigatoria" || (item.area === "banner" && item.options?.art_mode === "equipe"));

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function lookupCep(value) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    update("shipping_cep", digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits);
    if (digits.length !== 8) {
      setCepStatus("idle");
      return;
    }
    setCepStatus("loading");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepStatus("error");
        return;
      }
      update(
        "shipping_address",
        `${data.logradouro || ""}${data.bairro ? `, ${data.bairro}` : ""} — ${data.localidade}/${data.uf}`
      );
      setCepStatus("ok");
    } catch {
      setCepStatus("error");
    }
  }

  if (!ready || settingsLoading) return <p role="status" className="container-x flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando checkout…</p>;

  if (!items.length) {
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-3xl">Seu carrinho está vazio</h1>
        <p className="mt-2 text-sm text-muted-foreground">Adicione fotos ou produtos para finalizar um pedido.</p>
      </div>
    );
  }

  return (
    <div className="container-x py-12">
      <p className="eyebrow">Finalizar</p>
      <h1 className="mt-2 text-4xl">Checkout</h1>

      <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-[1.25rem] border border-border bg-card p-6">
            <h2 className="text-xl">Seus dados</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Use o nome completo (nome e sobrenome): é ele que registramos no pedido e ajuda a localizar suas fotos.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <CheckoutField label="Nome completo" value={form.customer_name} onChange={(v) => update("customer_name", v)} required />
              <CheckoutField label="E-mail" type="email" value={form.customer_email} onChange={(v) => update("customer_email", v)} required />
              <CheckoutField label="WhatsApp / telefone" value={form.customer_phone} onChange={(v) => update("customer_phone", v)} required />
              <CheckoutField label="CPF (para nota fiscal)" value={form.customer_cpf} onChange={(v) => update("customer_cpf", v)} />
            </div>
          </section>

          <section className="rounded-[1.25rem] border border-border bg-card p-6">
            <h2 className="text-xl">Como quer receber</h2>
            <div className={`mt-4 grid gap-3 ${shippingAvailable ? "sm:grid-cols-2" : ""}`}>
              <label className={`cursor-pointer rounded-xl border p-4 text-sm ${form.fulfillment === "retirada" ? "border-primary bg-accent/50" : "border-gold/45 bg-background hover:border-gold"}`}>
                <input
                  type="radio"
                  name="fulfillment"
                  className="mr-2 accent-primary"
                  checked={form.fulfillment === "retirada"}
                  onChange={() => { update("fulfillment", "retirada"); update("shipping_service", ""); }}
                />
                Retirada na loja
                <span className="mt-1 block text-xs text-muted-foreground">Sem frete — você busca o pedido na loja.</span>
              </label>
              {shippingAvailable ? (
                <label className={`cursor-pointer rounded-xl border p-4 text-sm ${form.fulfillment === "entrega" ? "border-primary bg-accent/50" : "border-gold/45 bg-background hover:border-gold"}`}>
                  <input
                    type="radio"
                    name="fulfillment"
                    className="mr-2 accent-primary"
                    checked={form.fulfillment === "entrega"}
                    onChange={() => update("fulfillment", "entrega")}
                  />
                  Receber em casa
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {settings?.shipping_enabled
                      ? `Frete fixo de ${formatBRL(settings?.shipping_flat || 0)}`
                      : "Calculamos o frete pelo seu CEP"}
                  </span>
                </label>
              ) : null}
            </div>
            {form.fulfillment === "retirada" ? (
              <PickupNotice address={settings?.address} hours={settings?.hours} pickupInfo={settings?.pickup_info} />
            ) : null}
            {form.fulfillment === "entrega" && (
              <>
                <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
                  <CheckoutField label="CEP" value={form.shipping_cep} onChange={lookupCep} required />
                  <CheckoutField label="Endereço completo, número e complemento" value={form.shipping_address} onChange={(v) => update("shipping_address", v)} required />
                </div>
                <p aria-live="polite" className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {cepStatus === "loading" ? <><Loader2 className="h-3 w-3 animate-spin" /> Buscando o CEP…</> : null}
                  {cepStatus === "ok" ? "Endereço preenchido automaticamente — complete com o número e o complemento." : null}
                  {cepStatus === "error" ? "Não encontramos este CEP. Digite o endereço manualmente." : null}
                  {cepStatus === "idle" ? "Digite o CEP para preencher o endereço automaticamente." : null}
                </p>
                {!settings?.shipping_enabled && settings?.shipping_quote_enabled ? (
                  <ShippingOptions
                    cep={form.shipping_cep}
                    subtotal={quote?.subtotal || 0}
                    value={form.shipping_service}
                    onChange={(option) => update("shipping_service", option.id)}
                  />
                ) : null}
              </>
            )}
          </section>

          <section className="rounded-[1.25rem] border border-border bg-card p-6">
            <h2 className="text-xl">Pagamento</h2>
            <div className="mt-4 space-y-3">
              <label className={`block cursor-pointer rounded-xl border p-4 text-sm ${form.payment_method === "mercadopago" ? "border-primary bg-accent/50" : "border-gold/45 bg-background hover:border-gold"}`}>
                <input
                  type="radio"
                  name="payment"
                  className="mr-2 accent-primary"
                  checked={form.payment_method === "mercadopago"}
                  disabled={!settings?.online_payment_enabled}
                  onChange={() => update("payment_method", "mercadopago")}
                />
                Mercado Pago (PIX ou cartão)
                <span className="mt-1 block text-xs text-muted-foreground">
                  {settings?.online_payment_enabled ? "Você é levado ao ambiente seguro do Mercado Pago para pagar." : "Pagamento online ainda indisponível. Você pode registrar o pedido e combinar o pagamento na loja."}
                </span>
              </label>
              <label className={`block cursor-pointer rounded-xl border p-4 text-sm ${form.payment_method === "retirada" ? "border-primary bg-accent/50" : "border-gold/45 bg-background hover:border-gold"}`}>
                <input
                  type="radio"
                  name="payment"
                  className="mr-2 accent-primary"
                  checked={form.payment_method === "retirada"}
                  onChange={() => update("payment_method", "retirada")}
                />
                Combinar o pagamento na loja
                <span className="mt-1 block text-xs text-muted-foreground">
                  O pedido fica registrado e a loja confirma o pagamento antes de produzir.
                </span>
              </label>
            </div>

            {needsApproval && (
              <div className="mt-5 rounded-xl bg-secondary/60 p-4">
                <p className="text-sm font-medium">Deseja receber a arte pelo WhatsApp para aprovar antes da produção?</p>
                <div className="mt-3 space-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="approval" checked={approval === "sim"} onChange={() => setApproval("sim")} className="accent-primary" />
                    Sim, quero aprovar
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="approval" checked={approval === "nao" && !mandatoryApproval} disabled={mandatoryApproval} onChange={() => setApproval("nao")} className="accent-primary" />
                    {mandatoryApproval ? "Aprovação obrigatória para este pedido" : "Não preciso aprovar"}
                  </label>
                </div>
              </div>
            )}

            <div className="mt-5">
              <CheckoutField label="Mensagem de presente (opcional)" value={form.gift_message} onChange={(v) => update("gift_message", v)} />
            </div>
          </section>
        </div>

        <CheckoutSummary quote={quote} calculating={calculating} coupon={coupon} setCoupon={setCoupon} submitting={submitting} error={error} readyDate={readyDate} />
      </form>
    </div>
  );
}
