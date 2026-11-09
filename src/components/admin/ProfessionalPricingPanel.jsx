import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import QuantitySimulator from "@/components/admin/QuantitySimulator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/areas";
import { getProfessionalPricingAdmin, saveProfessionalPricing } from "@/lib/professional-pricing-fns";
import { checkProfessionalTable, EMPTY_PROFESSIONAL_TABLE, professionalPricingData } from "@/lib/professional-pricing";
import { priceKey, sortTiers, tierRangeLabel } from "@/lib/quantity-pricing";
import { useEntityList } from "@/lib/store";
import { uid } from "@/lib/uid";

const queryKey = ["admin-professional-pricing"];
const quantity = (value) => value === "" ? null : Number(value);

export default function ProfessionalPricingPanel() {
  const client = useQueryClient();
  const getRecord = useServerFn(getProfessionalPricingAdmin);
  const saveRecord = useServerFn(saveProfessionalPricing);
  const recordQuery = useQuery({ queryKey, queryFn: () => getRecord() });
  const sizesQuery = useEntityList("PhotoSize", {}, { sort: "sort", limit: 1000 });
  const normalQuery = useEntityList("QuantityTier", { category: "revelacao", active: true }, { sort: "min_qty" });
  const [draft, setDraft] = useState(null);
  const record = recordQuery.data;
  const edited = draft?.table ?? record?.draft ?? EMPTY_PROFESSIONAL_TABLE;
  const sizes = (sizesQuery.data ?? []).filter((size) => size.active !== false && !size.is_photo_3x4);
  const table = {
    ...edited,
    prices: edited.prices.map((price) => ({
      ...price, unit_price: Math.round(Number(price.unit_price) * 100) / 100,
    })).filter((price) => Number.isFinite(price.unit_price) && price.unit_price > 0),
  };
  const validation = checkProfessionalTable(table, sizes);
  const publishedMissing = record?.published ? checkProfessionalTable(record.published, sizes).missing.length : 0;
  const values = new Map(edited.prices.map((price) => [priceKey(price.tier_id, price.size_id), price.unit_price]));
  const normalTiers = sortTiers(normalQuery.data);
  const saving = useMutation({
    mutationFn: (publish) => saveRecord({ data: { table, publish, revision: draft?.revision ?? record?.revision ?? 0 } }),
    onSuccess: (saved, publish) => {
      client.setQueryData(queryKey, saved);
      setDraft(null);
      if (publish) {
        client.invalidateQueries({ queryKey: ["shop-professional-pricing"] });
        client.invalidateQueries({ queryKey: ["checkout-quote"] });
      }
      toast.success(publish ? "Tabela profissional publicada." : "Rascunho salvo.");
    },
    onError: (error) => toast.error(error.message || "Não foi possível salvar a tabela."),
  });

  function change(update) {
    setDraft((current) => ({
      revision: current?.revision ?? record?.revision ?? 0,
      table: update(current?.table ?? record?.draft ?? EMPTY_PROFESSIONAL_TABLE),
    }));
  }

  function editTier(id, patch) {
    change((current) => ({ ...current, tiers: current.tiers.map((tier) => tier.id === id ? { ...tier, ...patch } : tier) }));
  }

  function addTier() {
    change((current) => {
      const last = current.tiers.at(-1);
      const start = last ? (last.max_qty || (last.min_qty || 1) + 14) + 1 : 1;
      const tiers = current.tiers.map((tier) => tier.id === last?.id && tier.max_qty === 0 ? { ...tier, max_qty: start - 1 } : tier);
      return { ...current, tiers: [...tiers, { id: uid(), label: "Faixa " + start, min_qty: start, max_qty: 0 }] };
    });
  }

  function removeTier(id) {
    change((current) => ({
      ...current,
      tiers: current.tiers.filter((tier) => tier.id !== id),
      prices: current.prices.filter((price) => price.tier_id !== id),
    }));
  }

  function editPrice(tierId, sizeId, value) {
    change((current) => ({
      ...current,
      prices: [
        ...current.prices.filter((price) => price.tier_id !== tierId || price.size_id !== sizeId),
        { tier_id: tierId, size_id: sizeId, unit_price: value },
      ],
    }));
  }

  function toggleSharedSize(sizeId, checked) {
    change((current) => ({
      ...current,
      shared_size_ids: checked ? [...new Set([...current.shared_size_ids, sizeId])] : current.shared_size_ids.filter((id) => id !== sizeId),
    }));
  }

  if (recordQuery.isPending || sizesQuery.isPending) return <p className="text-sm text-muted-foreground">Carregando tabela profissional…</p>;
  if (recordQuery.error || sizesQuery.error) {
    return <Button variant="outline" onClick={() => { recordQuery.refetch(); sizesQuery.refetch(); }}>Tentar carregar tabela novamente</Button>;
  }

  const simulation = validation.complete ? professionalPricingData(table) : null;
  return (
    <div className="space-y-5">
      <section className="card-glass p-4 sm:p-5">
        <h2 className="font-display text-xl">Tabela profissional de revelação</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {record?.published_at
            ? "Os clientes com preço especial usam a última tabela publicada. Salve o rascunho para continuar a edição depois."
            : "Os clientes com preço especial usam os preços normais até a primeira publicação."}
        </p>
        <p className="mt-2 text-xs font-medium">
          {record?.published_at ? "Última publicação em " + formatDate(record.published_at) : "Aguardando primeira publicação"}
        </p>
        {publishedMissing > 0 && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            A tabela publicada tem {publishedMissing} preço(s) pendente(s) para tamanhos ativos. Esses tamanhos usam os preços normais até a próxima publicação.
          </p>
        )}
      </section>

      <fieldset disabled={saving.isPending} className="space-y-5">
        <section className="card-glass p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg">Faixas por quantidade</h3>
              <p className="mt-1 text-xs text-muted-foreground">Comece em 1 e deixe o máximo da última faixa em 0 para abranger qualquer quantidade acima dela.</p>
            </div>
            <Button size="sm" variant="outline" onClick={addTier} disabled={edited.tiers.length >= 100}>
              <Plus className="mr-1 h-4 w-4" /> Nova faixa
            </Button>
          </div>
          {!edited.tiers.length && normalTiers.length > 0 && (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => change((current) => ({
              ...current,
              tiers: normalTiers.map((tier) => ({ id: uid(), label: tier.label, min_qty: tier.min_qty, max_qty: tier.max_qty ?? 0 })),
            }))}>Copiar faixas da tabela normal</Button>
          )}
          {edited.tiers.map((tier) => (
            <div key={tier.id} className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 rounded-lg border border-border p-2 sm:grid-cols-[minmax(0,1fr)_100px_100px_auto]">
              <label className="col-span-3 text-xs text-muted-foreground sm:col-span-1">
                Nome da faixa
                <Input className="mt-1" value={tier.label} maxLength={80} onChange={(event) => editTier(tier.id, { label: event.target.value })} />
              </label>
              <label className="text-xs text-muted-foreground">
                Mínimo
                <Input className="mt-1" type="number" min="1" max="50000" step="1" value={tier.min_qty ?? ""} onChange={(event) => editTier(tier.id, { min_qty: quantity(event.target.value) })} />
              </label>
              <label className="text-xs text-muted-foreground">
                Máximo
                <Input className="mt-1" type="number" min="0" max="50000" step="1" value={tier.max_qty ?? ""} onChange={(event) => editTier(tier.id, { max_qty: quantity(event.target.value) })} />
              </label>
              <Button size="icon" variant="ghost" onClick={() => removeTier(tier.id)} aria-label={"Remover " + tier.label}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </section>

        {edited.tiers.length > 0 && (
          <section className="card-glass p-4 sm:p-5">
            <h3 className="font-display text-lg">Preço por cópia</h3>
            <p className="mt-1 text-xs text-muted-foreground">Preencha um valor em reais para cada tamanho ativo e faixa.</p>
            {sizes.map((size) => (
              <div key={size.id} className="mt-3 rounded-lg border border-border p-3">
                <h4 className="text-sm font-semibold">{size.name}</h4>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {edited.tiers.map((tier) => (
                    <label key={tier.id} className="min-w-0 text-xs text-muted-foreground">
                      <span className="block truncate">{tier.label || "Faixa sem nome"} · {tierRangeLabel(tier)}</span>
                      <Input type="number" min="0.01" max="100000" step="0.01" inputMode="decimal"
                        className="mt-1" placeholder="R$"
                        value={values.get(priceKey(tier.id, size.id)) ?? ""}
                        onChange={(event) => editPrice(tier.id, size.id, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="card-glass p-4 sm:p-5">
          <h3 className="font-display text-lg">Somar quantidades entre tamanhos</h3>
          <p className="mt-1 text-xs text-muted-foreground">Os tamanhos selecionados somam suas cópias para definir a faixa. Cada tamanho mantém o próprio preço nessa faixa.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {sizes.map((size) => (
              <label key={size.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
                <input type="checkbox" checked={edited.shared_size_ids.includes(size.id)} onChange={(event) => toggleSharedSize(size.id, event.target.checked)} />
                {size.name}
              </label>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div aria-live="polite" className="text-xs text-muted-foreground">
            {validation.issue && <p>{validation.issue}</p>}
            {validation.missing.length > 0 && <p>{validation.missing.length} preço(s) a preencher.</p>}
            {validation.complete && <p>Tabela completa e pronta para publicar.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => saving.mutate(false)} disabled={!draft}>Salvar rascunho</Button>
            <Button onClick={() => saving.mutate(true)} disabled={!validation.complete}>Publicar tabela</Button>
          </div>
        </div>
      </fieldset>

      {simulation && <QuantitySimulator category="revelacao" sizes={sizes} tiers={simulation.tiers} prices={simulation.tierPrices} groups={simulation.groups} />}
    </div>
  );
}
