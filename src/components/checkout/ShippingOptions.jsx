import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { quoteShippingOptions } from "@/lib/shipping-fns";
import { formatBRL } from "@/lib/areas";

export default function ShippingOptions({ cep, subtotal, value, onChange }) {
  const fetchOptions = useServerFn(quoteShippingOptions);
  const digits = (cep || "").replace(/\D/g, "");
  const query = useQuery({
    queryKey: ["shipping-options", digits, Math.round(Number(subtotal) || 0)],
    enabled: digits.length === 8,
    retry: false,
    queryFn: () => fetchOptions({ data: { cep: digits, subtotal: Number(subtotal) || 0 } }),
  });
  const options = query.data?.options ?? [];

  useEffect(() => {
    if (!value && options.length) onChange(options[0]);
  }, [value, options, onChange]);

  if (digits.length !== 8) {
    return <p className="mt-3 text-xs text-muted-foreground">Informe o CEP para calcular o frete.</p>;
  }
  if (query.isLoading) {
    return <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Calculando o frete…</p>;
  }
  if (!options.length) {
    return <p className="mt-3 text-xs text-muted-foreground">Não conseguimos calcular o frete agora. A loja combina a entrega com você.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {options.map((option) => (
        <label
          key={option.id}
          className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${value === option.id ? "border-primary bg-accent/50" : "border-gold/45 bg-background hover:border-gold"}`}
        >
          <span className="flex items-center">
            <input
              type="radio"
              name="shipping_service"
              className="mr-2 accent-primary"
              checked={value === option.id}
              onChange={() => onChange(option)}
            />
            {option.company ? `${option.company} · ` : ""}{option.name}
          </span>
          <span className="text-right text-xs text-muted-foreground">
            <span className="block text-sm font-medium text-foreground">{formatBRL(option.price)}</span>
            {option.days ? `${option.days} dia(s) útil(eis)` : "prazo a confirmar"}
          </span>
        </label>
      ))}
    </div>
  );
}