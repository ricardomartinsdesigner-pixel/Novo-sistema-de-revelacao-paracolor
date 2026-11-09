import { Link } from "@tanstack/react-router";
import { Menu, ShoppingBag, User } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { moduleEnabled, useSettings } from "@/lib/store";
import { useAuth } from "@/lib/AuthContext";
import { useAreas, useSiteContent } from "@/hooks/use-site-content";
import { Image } from "@/components/ui/image";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import ThemeToggle from "@/components/site/ThemeToggle";
import { publicPageEnabled } from "@/lib/public-pages";

function CartLink({ enabled }) {
  const { count } = useCart();
  if (!enabled) return null;
  return (
    <Link
      to="/carrinho"
      className="relative flex items-center gap-2 text-sm text-ink-foreground/80 transition hover:text-gold"
    >
      <ShoppingBag className="h-5 w-5" strokeWidth={1.4} />
      <span className="hidden sm:inline">Carrinho</span>
      {count > 0 && (
        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-gold-foreground sm:static sm:ml-1">
          {count}
        </span>
      )}
    </Link>
  );
}

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, navigateToLogin, isLoadingAuth } = useAuth();
  const { settings } = useSettings();
  const { content } = useSiteContent();
  const allAreas = useAreas();
  const areas = allAreas.filter((area) => moduleEnabled(settings, area.key));
  const logo = "/brand/paracolor-logo.png";
  const storeName = settings?.store_name || "Paracolor";
  const accountEnabled = publicPageEnabled(settings, "page_minha_conta");
  const cartEnabled = publicPageEnabled(settings, "page_carrinho");

  const navLinks = [
    ...areas.map((area) => ({ key: area.key, to: area.path, label: area.label })),
    ...(moduleEnabled(settings, "servicos") ? [{ key: "servicos", to: "/servicos", label: content["nav.servicos"] }] : []),
    ...(moduleEnabled(settings, "estudio")
      ? [{ key: "estudio", to: "/estudio-fotografico", label: content["nav.estudio"] }]
      : []),
  ];

  return (
    <header id="topo-da-loja" tabIndex={-1} className="sticky top-0 z-40 focus:outline-none shadow-[0_24px_60px_-46px_rgba(0,0,0,0.85)]">
      <div className="ink-panel border-b border-gold/20 backdrop-blur-xl">
        <div className="container-x grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-3.5 sm:py-4">
          <div className="flex items-center">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button type="button" aria-label="Abrir menu" className="lg:hidden">
                  <Menu className="h-6 w-6 text-ink-foreground" strokeWidth={1.4} />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[86vw] max-w-sm">
                <SheetTitle className="font-display text-xl">O que você quer imprimir?</SheetTitle>
                <div className="mt-8 flex flex-col gap-1">
                  {areas.map((area) => (
                    <Link
                      key={area.key}
                      to={area.path}
                      onClick={() => setOpen(false)}
                      className="flex flex-col rounded-xl px-3 py-3 transition hover:bg-secondary"
                    >
                      <span className="text-base">{area.label}</span>
                      <span className="mt-0.5 text-xs text-muted-foreground">{area.tagline}</span>
                    </Link>
                  ))}
                </div>
                <div className="mt-6 border-t border-border pt-5">
                  {moduleEnabled(settings, "servicos") ? (
                    <Link to="/servicos" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-foreground/80">
                      {content["nav.servicos"]}
                    </Link>
                  ) : null}
                  {moduleEnabled(settings, "estudio") ? (
                    <Link
                      to="/estudio-fotografico"
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 text-sm text-foreground/80"
                    >
                      {content["nav.estudio"]}
                    </Link>
                  ) : null}
                  {accountEnabled ? <Link
                    to="/minha-conta"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 text-sm text-foreground/80"
                  >Minha conta e pedidos</Link> : null}
                  {publicPageEnabled(settings, "page_contato") ? <Link to="/contato" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-foreground/80">
                    Falar com a {storeName}
                  </Link> : null}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Link to="/" className="flex min-w-0 flex-col items-center gap-1.5" aria-label={storeName}>
            {logo ? (
              <Image
                src={logo}
                alt={storeName}
                className="h-11 w-auto max-w-[190px] object-contain sm:h-14 sm:max-w-[240px]"
                fittingType="fit"
              />
            ) : (
              <span className="font-display text-3xl leading-none tracking-[0.16em] text-ink-foreground drop-shadow-[0_2px_18px_rgba(214,180,118,0.25)] sm:text-[2.6rem]">
                {storeName}
              </span>
            )}
          </Link>

          <div className="flex items-center justify-end gap-4 sm:gap-5">
            <ThemeToggle enabled={settings?.dark_mode_enabled !== false} />
            {accountEnabled && !isLoadingAuth &&
              (isAuthenticated ? (
                <Link
                  to="/minha-conta"
                  className="hidden items-center gap-2 text-sm text-ink-foreground/80 transition hover:text-gold lg:flex"
                >
                  <User className="h-5 w-5" strokeWidth={1.4} />
                  Minha conta
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateToLogin()}
                  className="hidden items-center gap-2 text-sm text-ink-foreground/80 transition hover:text-gold lg:flex"
                >
                  <User className="h-5 w-5" strokeWidth={1.4} />
                  Entrar
                </button>
              ))}
            <CartLink enabled={cartEnabled} />
          </div>
        </div>
      </div>

      <div className="border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <nav aria-label="Navegação principal" className="container-x hidden h-11 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block">
          <div className="flex h-full w-max min-w-full items-center justify-start gap-2 whitespace-nowrap xl:gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.key}
                to={link.to}
                className="relative shrink-0 whitespace-nowrap rounded-full px-1.5 py-2 text-[9px] font-medium uppercase tracking-[0.06em] text-foreground/75 transition hover:bg-secondary hover:text-foreground xl:px-2 xl:text-[10px]"
                activeProps={{ className: "bg-gold/15 font-semibold text-[hsl(var(--gold-deep))] shadow-sm hover:bg-gold/20" }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-gold to-transparent" />
      </div>
    </header>
  );
}
