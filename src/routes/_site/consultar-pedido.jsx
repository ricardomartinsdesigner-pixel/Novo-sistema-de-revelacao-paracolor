import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lookupOrder } from "@/lib/public-order-fns";
import { STATUS_LABELS, formatBRL, formatDate } from "@/lib/areas";

export const Route = createFileRoute("/_site/consultar-pedido")({
  head: () => ({
    meta: [
      { title: "Consultar pedido — Paracolor" },
      { name: "description", content: "Acompanhe o andamento do seu pedido com o número e o e-mail usados na compra." },
    ],
  }),
  component: ConsultarPedidoPage,
});

function ConsultarPedidoPage() {
  const find = useServerFn(lookupOrder);
  const [form, setForm] = useState({ order_number: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!form.order_number.trim() || !form.email.trim()) {
      setError("Informe o número do pedido e o e-mail da compra.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      setResult(await find({ data: { order_number: form.order_number, email: form.email } }));
    } catch {
      setError("Não conseguimos consultar agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  const order = result?.found ? result.order : null;

  return (
    <div className="container-x max-w-2xl py-14">
      <p className="eyebrow">Acompanhamento</p>
      <h1 className="mt-2 text-4xl">Consultar meu pedido</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use o número do pedido (começa com PEDIDO_) e o e-mail informado na compra. Não precisa de senha.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3 rounded-[1.25rem] border border-border bg-card p-5">
        <label className="block text-xs font-medium">
          Número do pedido
          <input
            value={form.order_number}
            onChange={(event) => setForm((current) => ({ ...current, order_number: event.target.value }))}
            placeholder="PEDIDO_20260101_AB12CD34"
            className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block text-xs font-medium">
          E-mail da compra
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="voce@email.com"
            className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full gap-2 rounded-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Consultar
        </Button>
      </form>

      {result && !result.found ? (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          Não encontramos um pedido com esse número e e-mail. Confira a grafia ou fale com a loja pelo WhatsApp.
        </p>
      ) : null}

      {order ? (
        <section className="mt-6 rounded-[1.25rem] border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{order.order_number}</p>
              <p className="mt-1 text-xs text-muted-foreground">Feito em {formatDate(order.created_date)}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
              <Package className="h-3.5 w-3.5" /> {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>

          <p className="mt-4 rounded-lg bg-accent px-3 py-2 text-sm"><strong>Próximo passo:</strong> {order.next_step}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {order.items.map((item, index) => (
              <li key={`${item.product_name}-${index}`} className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
                <span>
                  {item.product_name}
                  <span className="block text-[11px] text-muted-foreground">
                    {item.variant || ""} {item.photo_count ? `· ${item.photo_count} foto(s)` : ""}
                  </span>
                </span>
                <span className="text-xs">{formatBRL(item.line_total)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1 text-xs text-muted-foreground">
            <p>Pagamento: <strong className="text-foreground">{order.payment_status}</strong></p>
            <p>{order.fulfillment === "entrega" ? `Entrega: ${order.shipping_label || "a combinar"}` : "Retirada na loja"}</p>
            {order.production_deadline_label || order.production_days ? <p>Prazo de produção: {order.production_deadline_label || `${order.production_days} dia(s) útil(eis)`}</p> : null}
            <p className="pt-1 text-sm font-medium text-foreground">Total: {formatBRL(order.total)}</p>
          </div>

          {order.status_history.length ? (
            <ol className="mt-5 space-y-2">
              {order.status_history.map((entry, index) => (
                <li key={`${entry.status}-${index}`} className="flex gap-2 text-xs">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                  <span>
                    <strong className="font-medium">{STATUS_LABELS[entry.status] || entry.status}</strong>
                    <span className="block text-muted-foreground">{formatDate(entry.date)}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
