import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { releaseOrderByNumber } from "@/lib/store-fns";

/** Baixa de pedido: digita o número, aperta Enter e o pedido sai como entregue/retirado. */
export default function OrderReleasePanel({ onReleased }) {
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const release = useServerFn(releaseOrderByNumber);

  async function submit(event) {
    event.preventDefault();
    const term = number.trim();
    if (!term || busy) return;
    setBusy(true);
    try {
      const order = await release({ data: { number: term } });
      const action = order.fulfillment === "entrega" ? "entregue" : "retirado";
      toast.success(`Pedido ${order.label} baixado como ${action}.`);
      setNumber("");
      await onReleased?.();
    } catch (error) {
      toast.error(error?.message || "Não foi possível dar baixa no pedido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 card-glass p-4">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="release-number" className="flex items-center gap-1.5 text-sm font-semibold">
            <PackageCheck className="h-4 w-4 text-gold-deep" />
            Baixa de pedido
          </label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Digite o número do pedido e aperte Enter — ele é concluído como entregue ou retirado e sai das entregas na hora.
          </p>
        </div>

        <div className="flex w-full gap-2 sm:w-auto">
          <input
            id="release-number"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="Número do pedido"
            autoComplete="off"
            disabled={busy}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25 disabled:opacity-60 sm:w-48"
          />
          <Button type="submit" disabled={busy || !number.trim()} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            Dar baixa
          </Button>
        </div>
      </form>
    </section>
  );
}