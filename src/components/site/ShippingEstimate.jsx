import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Truck } from "lucide-react";
import { estimateShipping } from "@/lib/shipping-fns";
import { formatBRL } from "@/lib/areas";

// Consulta rápida de frete na página do produto: o cliente vê o custo de envio
// antes de entrar no checkout.
export default function ShippingEstimate() {
  const quote = useServerFn(estimateShipping);
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      setError("Digite os 8 números do CEP.");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await quote({ data: { cep: digits } });
      setResult(data.options?.[0] ?? false);
    } catch {
      setError("Não conseguimos calcular agora. Fale com a loja.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 max-w-sm">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={cep}
          onChange={(event) => setCep(event.target.value)}
          inputMode="numeric"
          maxLength={9}
          placeholder="CEP para calcular o frete"
          aria-label="CEP para calcular o frete"
          className="h-10 min-w-0 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-gold px-4 text-xs font-medium text-gold-deep transition hover:border-gold-deep hover:bg-gold-soft disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
          Calcular
        </button>
      </form>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {result ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Truck className="h-3.5 w-3.5 text-primary" />
          Frete a partir de <strong className="text-foreground">{formatBRL(result.price)}</strong>
          {result.days ? ` · até ${result.days} dia(s) útil(eis)` : ""}
        </p>
      ) : null}
      {result === false ? (
        <p className="mt-2 text-xs text-muted-foreground">Sem frete calculado para este CEP. Fale com a loja.</p>
      ) : null}
    </div>
  );
}