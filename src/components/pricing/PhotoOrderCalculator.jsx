import { useState } from "react";
import { ArrowRight, Clipboard, LoaderCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";
import { useQuantityPricing } from "@/hooks/use-quantity-pricing";
import { formatBRL } from "@/lib/areas";
import { moduleEnabled, useEntityList, useSettings } from "@/lib/store";
import { photoCounts, pricingContext } from "@/lib/quantity-pricing";

const PRODUCTS = [
  { key: "revelacao", module: "revelacao", entity: "PhotoSize", title: "Revelação de fotos", description: "Informe a quantidade de cópias por tamanho." },
  { key: "polaroid", module: "polaroids", entity: "PolaroidModel", title: "Polaroides", description: "Escolha quantas unidades deseja de cada modelo." },
];

export default function PhotoOrderCalculator({ mode = "customer" }) {
  const isAdmin = mode === "admin";
  const { settings } = useSettings();
  const pricing = useQuantityPricing();
  const reveal = useEntityList("PhotoSize", { active: true }, { sort: "sort" });
  const polaroid = useEntityList("PolaroidModel", { active: true }, { sort: "sort" });
  const [quantities, setQuantities] = useState({});
  const lists = { revelacao: reveal.data ?? [], polaroid: polaroid.data ?? [] };
  const shown = PRODUCTS.filter((product) => isAdmin || moduleEnabled(settings, product.module));
  const lines = PRODUCTS.flatMap(({ key }) => (lists[key] ?? [])
    .map((size) => ({
      area: key,
      sizeId: size.id,
      copies: Math.max(0, Math.floor(Number(quantities[`${key}:${size.id}`]) || 0)),
    }))
    .filter((line) => line.copies > 0));
  const counts = photoCounts(lines);
  const context = pricingContext({ ...pricing.data, counts });
  const rows = shown.flatMap((product) => (lists[product.key] ?? []).flatMap((size) => {
    const copies = Math.max(0, Math.floor(Number(quantities[`${product.key}:${size.id}`]) || 0));
    if (!copies) return [];
    const info = context[product.key]?.[size.id];
    const unitCents = Math.round((Number(info?.unit ?? size.price) || 0) * 100);
    return [{
      id: `${product.key}:${size.id}`,
      area: product.key,
      name: size.name,
      copies,
      unitCents,
      tier: info?.tier?.label || "Preço do catálogo",
      subtotalCents: unitCents * copies,
    }];
  }));
  const totalCents = rows.reduce((sum, row) => sum + row.subtotalCents, 0);
  const unitCount = rows.reduce((sum, row) => sum + row.copies, 0);
  const loading = pricing.isLoading || reveal.isLoading || polaroid.isLoading;

  function updateQuantity(key, raw) {
    setQuantities((current) => ({
      ...current,
      [key]: raw === "" ? "" : String(Math.max(0, Math.floor(Number(raw) || 0))),
    }));
  }

  async function copyQuote() {
    if (!rows.length) return toast.info("Informe a quantidade de pelo menos um formato.");
    const storeName = settings?.store_name || "Paracolor";
    const quote = [
      `Orçamento de fotos — ${storeName}`,
      ...rows.map((row) => `${row.copies} × ${row.name} (${row.area === "polaroid" ? "Polaroide" : "Revelação"}) — ${formatBRL(row.subtotalCents / 100)} (${formatBRL(row.unitCents / 100)} cada)`),
      `Total de unidades: ${unitCount}`,
      `Total estimado: ${formatBRL(totalCents / 100)}`,
      "Estimativa calculada pelos preços e faixas atuais do catálogo. Frete, acabamentos, campanhas ou cupons podem alterar o valor final.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(quote);
      toast.success("Orçamento copiado para compartilhar.");
    } catch {
      toast.error("Não foi possível copiar o orçamento neste navegador.");
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando formatos e faixas de preço…
          </div>
        ) : shown.map((product) => (
          <section key={product.key} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="font-display text-2xl">{product.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
            </div>
            {lists[product.key]?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {lists[product.key].map((size) => {
                  const key = `${product.key}:${size.id}`;
                  return (
                    <label key={size.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/70 p-3.5">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{size.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">Catálogo: {formatBRL(size.price)} / un.</span>
                      </span>
                      <Input
                        aria-label={`Quantidade de ${size.name} em ${product.title}`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="1"
                        value={quantities[key] ?? ""}
                        onChange={(event) => updateQuantity(key, event.target.value)}
                        placeholder="0"
                        className="h-11 w-24 text-center text-base"
                      />
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Nenhum formato ativo no catálogo.</p>
            )}
          </section>
        ))}
      </div>

      <aside className="h-fit rounded-2xl border border-gold/50 bg-card p-5 shadow-lg lg:sticky lg:top-24">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">{isAdmin ? "Orçamento para o cliente" : "Resumo do pedido"}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={() => setQuantities({})} aria-label="Limpar quantidades" title="Limpar quantidades">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">O valor é atualizado conforme você informa as quantidades.</p>
        {rows.length ? (
          <div className="mt-5 max-h-72 space-y-3 overflow-auto pr-1">
            {rows.map((row) => (
              <div key={row.id} className="flex justify-between gap-3 border-b border-border/70 pb-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{row.copies} × {row.name}</span>
                  <span className="block text-xs text-muted-foreground">{row.tier} · {formatBRL(row.unitCents / 100)} cada</span>
                </span>
                <span className="whitespace-nowrap font-medium">{formatBRL(row.subtotalCents / 100)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl bg-muted/50 px-4 py-7 text-center text-sm text-muted-foreground">Digite uma quantidade para ver o total.</div>
        )}
        <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">{unitCount} unidade(s)</span>
          <span className="font-display text-2xl text-primary">{formatBRL(totalCents / 100)}</span>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Valor estimado para revelação e Polaroides. Frete, bordas, acabamentos, cupons e campanhas podem alterar o total no carrinho.
        </p>
        <div className="mt-5 grid gap-2">
          <Button type="button" onClick={copyQuote} variant="outline" className="w-full rounded-full" disabled={!rows.length}>
            <Clipboard className="mr-2 h-4 w-4" /> Copiar orçamento
          </Button>
          {!isAdmin && rows.length > 0 && (
            <Button asChild className="w-full rounded-full">
              <Link to={rows.every((row) => row.area === "polaroid") ? "/polaroids/criar" : "/revelar"}>
                Fazer pedido <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
