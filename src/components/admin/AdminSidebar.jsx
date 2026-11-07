import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import AdminNav from "@/components/admin/AdminNav";

export default function AdminSidebar({ pathname, email }) {
  const initial = (email || "P").trim().charAt(0).toUpperCase();

  return (
    <aside className="ink-panel hidden border-r border-gold/15 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col">
      <div className="px-6 pb-5 pt-7">
        <Link to="/admin" className="font-display text-2xl leading-none text-ink-foreground">
          Paracolor
        </Link>
        <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-gold-bright">Painel da loja</p>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-5">
        <AdminNav pathname={pathname} />
      </div>

      <div className="border-t border-white/10 p-3.5">
        <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/20 text-[11px] font-semibold text-gold-bright">
            {initial}
          </span>
          <p className="min-w-0 flex-1 truncate text-[11px] text-ink-foreground/70">{email}</p>
        </div>
        <Link
          to="/"
          className="mt-2 flex items-center gap-1.5 px-1 py-1 text-xs text-ink-foreground/55 transition hover:text-gold-bright"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a loja
        </Link>
      </div>
    </aside>
  );
}