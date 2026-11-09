import { lazy, Suspense, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const ToolsGrid = lazy(() => import("@/components/tools/ToolsGrid"));

export default function ToolsDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="text-left transition hover:text-gold">Ferramentas</button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl p-4 sm:p-6">
        <DialogHeader className="border-b border-border/70 pb-4 pr-8">
          <DialogTitle className="font-body text-2xl font-semibold tracking-normal">Ferramentas</DialogTitle>
          <DialogDescription>Escolha uma ferramenta por categoria. Seus arquivos são processados no próprio navegador.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-1 py-5">
          <Suspense fallback={<p role="status" className="p-4 text-sm text-muted-foreground">Carregando ferramentas…</p>}>
            <ToolsGrid onNavigate={() => setOpen(false)} />
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );
}
