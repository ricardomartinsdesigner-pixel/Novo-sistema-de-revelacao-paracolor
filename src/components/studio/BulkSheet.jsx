import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import BulkBar from "@/components/studio/BulkBar";

// Painel de ajustes em lote: no celular abre por cima da grade, sem precisar
// rolar até o fim de centenas de fotos.
export default function BulkSheet({ open, onOpenChange, ...props }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl pb-8">
        <SheetHeader>
          <SheetTitle className="text-left font-display text-xl">Ajustes em lote</SheetTitle>
        </SheetHeader>
        <p className="mt-1 text-left text-xs leading-snug text-muted-foreground">
          Formato, enquadramento, borda e cópias aplicados de uma vez — cada miniatura já mostra o resultado.
        </p>
        <BulkBar {...props} />
      </SheetContent>
    </Sheet>
  );
}