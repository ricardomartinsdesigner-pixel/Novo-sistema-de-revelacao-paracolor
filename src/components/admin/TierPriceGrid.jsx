import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { tierRangeLabel } from "@/lib/quantity-pricing";

export default function TierPriceGrid({ category, sizes, tiers, prices, onSaved }) {
  const existing = new Map(prices.map((price) => [`${price.tier_id}:${price.size_id}`, price]));
  const [filling, setFilling] = useState(false);

  // Cria as células que faltam usando o preço do catálogo como base: a loja já
  // fica com todas as faixas válidas e ajusta só as que têm desconto.
  async function fillFromCatalog() {
    const missing = [];
    for (const size of sizes) {
      for (const tier of tiers) {
        if (existing.has(`${tier.id}:${size.id}`)) continue;
        const unit = Number(size.price);
        if (!Number.isFinite(unit) || unit <= 0) continue;
        missing.push({ tier_id: tier.id, category, size_id: size.id, size_name: size.name, unit_price: unit });
      }
    }
    if (!missing.length) {
      toast.info("Todas as faixas já estão preenchidas.");
      return;
    }
    setFilling(true);
    try {
      await base44.entities.TierPrice.bulkCreate(missing);
      toast.success(`${missing.length} preços preenchidos`);
      onSaved?.();
    } catch (error) {
      toast.error(error?.message || "Não foi possível preencher os preços.");
    } finally {
      setFilling(false);
    }
  }

  async function save(size, tier, raw) {
    if (!String(raw).trim()) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return;
    const record = existing.get(`${tier.id}:${size.id}`);
    if (record && Number(record.unit_price) === value) return;
    try {
      if (record) {
        await base44.entities.TierPrice.update(record.id, { unit_price: value });
      } else {
        await base44.entities.TierPrice.create({
          tier_id: tier.id,
          category,
          size_id: size.id,
          size_name: size.name,
          unit_price: value,
        });
      }
      toast.success(`Preço de ${size.name} salvo`);
      onSaved?.();
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar o preço.");
    }
  }

  if (!tiers.length) return null;

  return (
    <section className="card-glass p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Preço unitário por faixa</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Valor por foto, em reais. Vazio usa o preço do catálogo. Ao sair do campo o preço é salvo.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fillFromCatalog} disabled={filling} className="gap-1.5">
          {filling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Preencher com preço do catálogo
        </Button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 bg-card py-2 pr-3">Tamanho</th>
              {tiers.map((tier) => (
                <th key={tier.id} className="px-1 py-2 font-normal">
                  {tier.label}
                  <span className="block text-[10px] opacity-70">{tierRangeLabel(tier)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizes.map((size) => (
              <tr key={size.id} className="border-t border-border/60">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-card py-2 pr-3">{size.name}</td>
                {tiers.map((tier) => {
                  const record = existing.get(`${tier.id}:${size.id}`);
                  return (
                    <td key={tier.id} className="px-1 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={record ? Number(record.unit_price) : ""}
                        placeholder={String(size.price ?? "")}
                        aria-label={`Preço de ${size.name} na faixa ${tier.label}`}
                        onBlur={(event) => save(size, tier, event.target.value)}
                        className="h-9 min-w-[88px]"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}