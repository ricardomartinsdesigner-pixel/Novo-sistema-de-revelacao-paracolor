import { Outlet, useRouterState } from "@tanstack/react-router";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import WhatsAppFloat from "@/components/site/WhatsAppFloat";
import { AREAS } from "@/lib/areas";
import { moduleEnabled, useSettings } from "@/lib/store";

export default function SiteLayout() {
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const area = AREAS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
  const blocked = Boolean(area && settings && !moduleEnabled(settings, area.key));

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <SiteHeader />
      <main className="flex-1">
        {blocked ? (
          <div className="container-x py-24 text-center">
            <p className="eyebrow">Área indisponível</p>
            <h1 className="mt-3 text-3xl">Esta área está temporariamente desativada</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A Paracolor desativou {area.label.toLowerCase()} no momento. Fale com a gente para saber quando volta.
            </p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <SiteFooter />
      <WhatsAppFloat />
    </div>
  );
}