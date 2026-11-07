import { Link } from "@tanstack/react-router";
import {
  Archive,
  BarChart3,
  Camera,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Package,
  Percent,
  Power,
  Printer,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  ToggleLeft,
  Truck,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNewOrders } from "@/hooks/use-new-orders";

const GROUPS = [
  {
    label: "Operação",
    links: [
      { to: "/admin", label: "Visão geral", icon: LayoutDashboard },
      { to: "/admin/relatorios", label: "Relatórios", icon: BarChart3 },
      { to: "/admin/pedidos", label: "Pedidos", icon: Package },
      { to: "/admin/producao", label: "Produção", icon: Printer },
      { to: "/admin/entregas", label: "Entregas", icon: Truck },
      { to: "/admin/pagamentos", label: "Pagamentos", icon: Wallet },
      { to: "/admin/carrinhos", label: "Carrinhos", icon: ShoppingCart },
    ],
  },
  {
    label: "Cadastros",
    links: [
      { to: "/admin/catalogo", label: "Catálogo", icon: ShoppingBag },
      { to: "/admin/precos", label: "Preços e descontos", icon: Percent },
      { to: "/admin/clientes", label: "Clientes", icon: Users },
      { to: "/admin/equipe", label: "Equipe", icon: UserCog },
    ],
  },
  {
    label: "Loja",
    links: [
      { to: "/admin/servicos", label: "Serviços", icon: Sparkles },
      { to: "/admin/estudio", label: "Estúdio", icon: Camera },
      { to: "/admin/conteudo", label: "Conteúdo", icon: FileText },
      { to: "/admin/divulgacao", label: "Divulgação", icon: Megaphone },
      { to: "/admin/mensagens", label: "Mensagens", icon: MessageCircle },
      { to: "/admin/modulos", label: "Módulos", icon: ToggleLeft },
    ],
  },
  {
    label: "Sistema",
    links: [
      { to: "/admin/ferramentas", label: "Ferramentas", icon: Wrench },
      { to: "/admin/arquivos", label: "Arquivos e retenção", icon: Archive },
      { to: "/admin/manutencao", label: "Manutenção", icon: Power },
      { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

export default function AdminNav({ pathname, onNavigate }) {
  const { total: newOrders } = useNewOrders();

  return (
    <nav className="space-y-5">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-foreground/40">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.links.map((link) => {
              const active =
                link.to === "/admin"
                  ? pathname === "/admin"
                  : pathname === link.to || pathname.startsWith(`${link.to}/`);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-gold font-medium text-gold-foreground shadow-[0_12px_26px_-18px_rgba(0,0,0,0.9)]"
                      : "text-ink-foreground/65 hover:bg-white/10 hover:text-ink-foreground"
                  )}
                >
                  <link.icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                  <span className="truncate">{link.label}</span>
                  {link.to === "/admin/pedidos" && newOrders > 0 ? (
                    <span
                      className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground"
                      aria-label={`${newOrders} pedidos novos`}
                    >
                      {newOrders > 99 ? "99+" : newOrders}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}