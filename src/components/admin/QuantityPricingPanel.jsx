import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Percent, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useEntityList } from "@/lib/store";
import { categoryLabel } from "@/lib/quantity-pricing";
import TierPriceGrid from "@/components/admin/TierPriceGrid";
import QuantitySimulator from "@/components/admin/QuantitySimulator";

const QUERY_KEYS = ["QuantityTier", "TierPrice", "PriceGroup"];

export default function QuantityPricingPanel({ category, entity }) {
  const queryClient = useQueryClient();
  const sizesQuery = useEntityList(entity, {}, { sort: "sort" });
  const tiersQuery = useEntityList("QuantityTier", { category }, { sort: "min_qty" });
  const pricesQuery = useEntityList("TierPrice", { category }, { limit: 500 });
  const groupsQuery = useEntityList("PriceGroup", { category }, { sort: "sort" });

  const sizes = (sizesQuery.data ?? []).filter((size) =>
    (category !== "magnet" || size.kind !== "strip_kit") && (category !== "revelacao" || !size.is_photo_3x4)
  );
  const tiers = tiersQuery.data ?? [];
  const prices = (pricesQuery.data ?? []).filter((price) => !price.category || price.category === category);
  const sharedGroup = (groupsQuery.data ?? [])[0];

  function refresh() {
    QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  }

  async function run(action, success) {
    try {
      await action();
      if (success) toast.success(success);
      refresh();
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar.");
    }
  }

  function addTier() {
    const last = tiers.reduce(
      (max, tier) => Math.max(max, Number(tier.max_qty) || Number(tier.min_qty) || 0),
      0
    );
    const min = last ? last + 1 : 1;
    run(
      () =>
        base44.entities.QuantityTier.create({
          category,
          label: `Faixa ${min}`,
          min_qty: min,
          max_qty: 0,
          active: true,
          sort: min,
        }),
      "Faixa criada. Defina o limite e os preços."
    );
  }

  function saveTier(tier, patch) {
    run(() => base44.entities.QuantityTier.update(tier.id, patch));
  }

  async function removeTier(tier) {
    if (!window.confirm(`Excluir a faixa “${tier.label}”? Os preços dessa faixa também serão removidos.`)) return;
    run(async () => {
      const removed = prices.filter((price) => price.tier_id === tier.id);
      await Promise.all(removed.map((price) => base44.entities.TierPrice.delete(price.id)));
      await base44.entities.QuantityTier.delete(tier.id);
    }, "Faixa excluída");
  }

  function toggleSharedSize(sizeId, checked) {
    const current = sharedGroup?.size_ids ?? [];
    const next = checked ? [...new Set([...current, sizeId])] : current.filter((id) => id !== sizeId);
    run(() =>
      sharedGroup
        ? base44.entities.PriceGroup.update(sharedGroup.id, { size_ids: next })
        : base44.entities.PriceGroup.create({
            category,
            name: `Contagem compartilhada — ${categoryLabel(category)}`,
            size_ids: next,
            active: true,
            sort: 1,
          })
    );
  }

  if (sizesQuery.isLoading || tiersQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando tabela de preços…
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section className="card-glass p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Faixas de quantidade</h2>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Deixe o limite final em 0 para “sem limite”. A faixa aplicada é a de maior mínimo alcançado pela
              quantidade total do grupo.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addTier}>
            <Plus className="mr-1 h-4 w-4" /> Nova faixa
          </Button>
        </div>

        {tiers.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            Nenhuma faixa criada. Sem faixas, vale o preço do catálogo.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Nome da faixa</th>
                  <th className="px-2 py-2">De</th>
                  <th className="px-2 py-2">Até</th>
                  <th className="px-2 py-2">Ativa</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => (
                  <tr key={tier.id} className="border-t border-border/60">
                    <td className="py-2 pr-3">
                      <Input
                        defaultValue={tier.label}
                        onBlur={(event) => event.target.value !== tier.label && saveTier(tier, { label: event.target.value })}
                        className="h-9 min-w-[140px]"
                      />
                    </td>
                    <td className="px-1 py-2">
                      <Input
                        type="number"
                        min="1"
                        defaultValue={tier.min_qty}
                        onBlur={(event) =>
                          Number(event.target.value) !== Number(tier.min_qty) &&
                          saveTier(tier, { min_qty: Number(event.target.value) })
                        }
                        className="h-9 w-24"
                      />
                    </td>
                    <td className="px-1 py-2">
                      <Input
                        type="number"
                        min="0"
                        defaultValue={tier.max_qty ?? 0}
                        onBlur={(event) =>
                          Number(event.target.value) !== Number(tier.max_qty ?? 0) &&
                          saveTier(tier, { max_qty: Number(event.target.value) })
                        }
                        className="h-9 w-24"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Switch checked={tier.active !== false} onCheckedChange={(value) => saveTier(tier, { active: value })} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeTier(tier)} aria-label={`Excluir ${tier.label}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TierPriceGrid category={category} sizes={sizes} tiers={tiers} prices={prices} onSaved={refresh} />

      <section className="card-glass p-5">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Percent className="h-4 w-4" /> Contagem compartilhada
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
          Os tamanhos marcados somam a mesma quantidade para alcançar as faixas. Ex.: 10 fotos 10x15 + 3 fotos 13x18 +
          3 fotos 15x21 chegam juntos à faixa de 16 a 99.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sizes.map((size) => (
            <label key={size.id} className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(var(--primary))]"
                checked={(sharedGroup?.size_ids ?? []).includes(size.id)}
                onChange={(event) => toggleSharedSize(size.id, event.target.checked)}
              />
              {size.name}
            </label>
          ))}
        </div>
      </section>

      <QuantitySimulator
        category={category}
        sizes={sizes}
        tiers={tiers}
        prices={prices}
        groups={sharedGroup ? [sharedGroup] : []}
      />
    </div>
  );
}
