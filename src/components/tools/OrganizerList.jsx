import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";

// Lista de páginas com controles de ordem: usada pelo juntador de PDF e pelo montador de fotos.
export default function OrganizerList({ items, onMove, onRemove, emptyLabel }) {
  if (!items.length) {
    return (
      <p className="mt-3 rounded-lg bg-secondary/60 p-3 text-[11px] text-muted-foreground">
        {emptyLabel || "Nenhuma página ainda."}
      </p>
    );
  }

  return (
    <ol className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
      {items.map((item, index) => (
        <li key={item.key} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
          <span className="w-5 shrink-0 text-center text-[11px] text-muted-foreground">{index + 1}</span>
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-border bg-secondary/60">
            {item.thumb ? (
              <Image src={item.thumb} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[9px] uppercase text-muted-foreground">PDF</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{item.label}</p>
            {item.sub ? <p className="truncate text-[10px] text-muted-foreground">{item.sub}</p> : null}
          </div>
          <div className="flex shrink-0 items-center">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="Mover para cima">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onMove(index, 1)} disabled={index === items.length - 1} aria-label="Mover para baixo">
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => onRemove(index)} aria-label="Remover página">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}