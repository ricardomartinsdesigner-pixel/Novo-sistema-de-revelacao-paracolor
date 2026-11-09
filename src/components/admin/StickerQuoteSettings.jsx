import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sticker } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/store";

const FIELDS = [
  { key: "sticker_price_a4", label: "Preço por folha A4", unit: "R$ / folha" },
  { key: "sticker_price_a3", label: "Preço por folha A3", unit: "R$ / folha" },
  { key: "sticker_price_per_meter", label: "Preço por metro de adesivo", unit: "R$ / metro" },
  { key: "sticker_minimum_charge", label: "Cobrança mínima na opção por metro", unit: "R$ mínimo" },
];

const initialForm = (settings) => Object.fromEntries(FIELDS.map(({ key }) => [
  key, settings?.[key] === null || settings?.[key] === undefined ? "" : String(settings[key]),
]));

export default function StickerQuoteSettings() {
  const { settings, isLoading } = useSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings && !form) setForm(initialForm(settings));
  }, [settings, form]);

  async function save() {
    const values = {};
    for (const { key, label } of FIELDS) {
      const value = Number(String(form[key]).replace(",", "."));
      if (form[key].trim() === "" || !Number.isFinite(value) || value < 0) {
        toast.error(`Informe um valor válido para “${label}”.`);
        return;
      }
      values[key] = Math.round(value * 100) / 100;
    }

    setSaving(true);
    try {
      await base44.entities.Settings.update(settings.id, values);
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Preços da calculadora de adesivos salvos.");
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar os preços.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !form) {
    return <section className="card-glass p-5"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando preços…</p></section>;
  }

  return (
    <section className="card-glass p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-primary/10 p-2 text-primary"><Sticker className="h-5 w-5" /></span>
        <div>
          <p className="eyebrow">Orçamento</p>
          <h2 className="mt-1 text-xl">Preços da calculadora de adesivos</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">Defina os valores usados no orçamento. Para bobina, a calculadora usa o consumo estimado pelo preço do metro e aplica a cobrança mínima quando necessário.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {FIELDS.map(({ key, label, unit }) => (
          <label key={key} className="block text-xs text-muted-foreground">
            {label}
            <span className="mt-1 flex items-center border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
              <input
                type="number" inputMode="decimal" min="0" step="0.01" value={form[key]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                aria-label={label}
                className="min-w-0 w-full bg-transparent px-3 py-2.5 text-sm text-foreground outline-none"
              />
              <span className="whitespace-nowrap px-3 text-[11px]">{unit}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">Na área do cliente, aparece apenas o valor final estimado. O cálculo não explica quando a cobrança mínima é aplicada.</p>
        <Button type="button" onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar preços
        </Button>
      </div>
    </section>
  );
}
