import { useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import BackToTop from "@/components/site/BackToTop";
import CampaignNotice from "@/components/site/CampaignNotice";
import InstallAppNotice from "@/components/site/InstallAppNotice";
import { useInstallApp } from "@/hooks/use-install-app";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import WhatsAppFloat from "@/components/site/WhatsAppFloat";
import { useAreas } from "@/hooks/use-site-content";
import { moduleEnabled, useSettings } from "@/lib/store";
import { publicPageEnabled, publicPageSettings } from "@/lib/public-pages";

const QUIET_PAGES = new Set(["/carrinho", "/checkout", "/revelar", "/polaroids/criar", "/banners/pedido"]);

export default function SiteLayout() {
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (state) => state.location.pathname.replace(/\/+$/, "") || "/" });
  const areas = useAreas();
  const home = pathname === "/";
  const hasStudioBar = pathname === "/revelar" || pathname === "/polaroids/criar";
  const [couponBusy, setCouponBusy] = useState(true);
  const disabledSettings = publicPageSettings(pathname).filter((key) => !publicPageEnabled(settings, key));
  const blocked = Boolean(settings && disabledSettings.length);
  const homeLinks = [
    ...areas.filter((item) => moduleEnabled(settings, item.key)).map((item) => ({ to: item.path, label: item.label })),
    ...(moduleEnabled(settings, "servicos") ? [{ to: "/servicos", label: "Serviços" }] : []),
    ...(moduleEnabled(settings, "estudio") ? [{ to: "/estudio-fotografico", label: "Estúdio Fotográfico" }] : []),
    ...(publicPageEnabled(settings, "page_contato") ? [{ to: "/contato", label: "Contato" }] : []),
  ];
  const install = useInstallApp({
    enabled: Boolean(settings) && !blocked && !QUIET_PAGES.has(pathname) && !pathname.startsWith("/pedido/"),
    waitingForCoupon: home && couponBusy,
  });

  const floatingBottom = install.inviteOpen
    ? "bottom-[calc(16rem+env(safe-area-inset-bottom))]"
    : "bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))]";

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <SiteHeader />
      <main className="flex-1">
        {home && !blocked && <CampaignNotice onPopupBusyChange={setCouponBusy} pausePopup={install.guideOpen} />}
        {blocked ? (
          home && disabledSettings.includes("page_home") ? (
            <section className="container-x py-16 sm:py-24">
              <div className="mx-auto max-w-2xl text-center">
                <p className="eyebrow">Paracolor</p>
                <h1 className="mt-3 text-3xl sm:text-4xl">A página inicial está temporariamente desativada</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Você ainda pode acessar as páginas da loja que estão disponíveis:</p>
              </div>
              {homeLinks.length ? <nav aria-label="Páginas disponíveis" className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {homeLinks.map((item) => <Link key={item.to} to={item.to} className="rounded-xl border border-border bg-card p-4 text-center text-sm transition hover:border-gold">{item.label}</Link>)}
              </nav> : <p className="mt-8 text-center text-sm text-muted-foreground">No momento não há outras páginas públicas ativas.</p>}
            </section>
          ) : (
            <section className="container-x py-24 text-center">
              <p className="eyebrow">Página indisponível</p>
              <h1 className="mt-3 text-3xl">Esta página está temporariamente desativada</h1>
              <p className="mt-2 text-sm text-muted-foreground">A Paracolor desativou esta página no momento. Você pode voltar ao início ou escolher outra área pelo menu.</p>
              <Button asChild className="mt-5 rounded-full"><Link to="/">Voltar ao início</Link></Button>
            </section>
          )
        ) : (
          <Outlet />
        )}
      </main>
      <SiteFooter onInstallApp={install.canInstall ? install.openInstall : undefined} />
      <div className={`pointer-events-none fixed right-4 z-40 flex flex-col items-end gap-3
        ${floatingBottom} ${hasStudioBar ? "" : "sm:bottom-5"}`}>
        <BackToTop />
        <WhatsAppFloat />
      </div>
      <InstallAppNotice install={install} />
    </div>
  );
}
