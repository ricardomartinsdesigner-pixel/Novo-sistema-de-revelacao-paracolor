import { Loader2, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

// Barra fixa no rodapé da tela: total, ajustes em lote e compra acompanham o
// cliente durante toda a edição, sem precisar rolar até o fim de centenas de fotos.
export default function StudioActionBar({ photoCount, total, alertCount, selectedCount = 0, busy, onAdd, onOpenBulk }) {
  if (!photoCount) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/25 bg-background/80 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-24px_50px_-34px_rgba(17,14,10,0.55)] backdrop-blur-xl">
      <div className="container-x flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight">
            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {photoCount} foto(s)
            {selectedCount ? ` · ${selectedCount} selecionada(s)` : ""}
            {alertCount ? ` · ${alertCount} com aviso` : ""}
          </p>
        </div>
        {onOpenBulk ? (
          <button
            type="button"
            onClick={onOpenBulk}
            aria-label="Abrir ajustes em lote"
            className="relative flex h-10 w-10 flex-none items-center justify-center rounded-full border border-gold/50 bg-background text-foreground transition hover:border-gold hover:bg-gold-soft"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {selectedCount ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                {selectedCount}
              </span>
            ) : null}
          </button>
        ) : null}
        <Button onClick={onAdd} disabled={busy} className="shrink-0 gap-2 rounded-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
          <span className="hidden sm:inline">Adicionar ao carrinho</span>
          <span className="sm:hidden">Carrinho</span>
        </Button>
      </div>
    </div>
  );
}