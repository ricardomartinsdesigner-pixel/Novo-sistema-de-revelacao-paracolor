import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/areas";
import { nextTierHint, photoCounts, pricingContext } from "@/lib/quantity-pricing";

export default function QuantitySimulator({ category, sizes, tiers, prices, groups }) {
  const [values, setValues] = useState({});
  const lines = sizes
    .map((size) => ({ area: category, sizeId: size.id, copies: Number(values[size.id]) || 0 }))
    .filter((line) => line.copies > 0);
  const context = pricingContext({ tiers, tierPrices: prices, groups, counts: photoCounts(lines) });
  const rows = sizes
    .map((size) => {
      const copies = Number(values[size.id]) || 0;
      if (!copies) return null;
      const info = context[category]?.[size.id];
      const unit = Number(info?.unit ?? size.price ?? 0);
      return { id: size.id, name: size.name, copies, unit, tier: info?.tier, total: unit * copies };
    })
    .filter(Boolean);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const units = rows.reduce((sum, row) => sum + row.copies, 0);
  const hint = nextTierHint(units, tiers);

  return (
    <section className="card-glass p-5">
      <h2 className="font-display text-xl">Simulador de desconto</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Digite as quantidades para ver a faixa aplicada e o total cobrado do cliente.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sizes.map((size) => (
          <label key={size.id} className="text-xs text-muted-foreground">
            {size.name}
            <Input
              type="number"
              min="0"
              value={values[size.id] ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, [size.id]: event.target.value }))}
              className="mt-1 h-9"
              placeholder="0"
            />
          </label>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Tamanho</th>
                <th className="py-2">Qtd.</th>
                <th className="py-2">Unitário</th>
                <th className="py-2">Faixa</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="py-2">{row.name}</td>
                  <td className="py-2">{row.copies}</td>
                  <td className="py-2">{formatBRL(row.unit)}</td>
                  <td className="py-2 text-muted-foreground">{row.tier?.label || "Catálogo"}</td>
                  <td className="py-2 text-right">{formatBRL(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm">
        <span className="text-muted-foreground">{units} unidade(s) no total</span>
        <span className="font-medium">Total: {formatBRL(total)}</span>
      </div>
      {hint && (
        <p className="mt-2 text-xs text-muted-foreground">
          Faltam {hint.missing} unidade(s) para a faixa a partir de {hint.min}.
        </p>
      )}
    </section>
  );
}