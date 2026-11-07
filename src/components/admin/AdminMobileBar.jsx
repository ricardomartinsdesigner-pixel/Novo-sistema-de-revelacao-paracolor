import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Menu } from "lucide-react";
import AdminNav from "@/components/admin/AdminNav";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default function AdminMobileBar({ pathname }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <Link to="/admin" className="min-w-0">
          <p className="font-display text-xl leading-none">Paracolor</p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-gold-deep">Painel da loja</p>
        </Link>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-gold/45 bg-card px-3.5 text-sm font-medium text-foreground"
            >
              <Menu className="h-4 w-4" /> Menu
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="ink-panel w-[86%] max-w-xs border-r border-gold/20 p-0">
            <SheetTitle className="sr-only">Menu do painel</SheetTitle>
            <div className="flex h-full flex-col">
              <div className="px-5 pb-4 pt-6">
                <p className="font-display text-2xl leading-none text-ink-foreground">Paracolor</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-gold-bright">
                  Painel da loja
                </p>
              </div>
              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                <AdminNav pathname={pathname} onNavigate={close} />
              </div>
              <div className="border-t border-white/10 p-3.5">
                <Link
                  to="/"
                  onClick={close}
                  className="flex items-center gap-1.5 px-1 py-1 text-xs text-ink-foreground/60 hover:text-gold-bright"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a loja
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}