import { createFileRoute } from "@tanstack/react-router";
import SiteLayout from "@/components/site/SiteLayout";
import MaintenanceScreen from "@/components/site/MaintenanceScreen";
import { CartProvider } from "@/lib/cart";
import { useAuth } from "@/lib/AuthContext";
import { useSettings } from "@/lib/store";

export const Route = createFileRoute("/_site")({
  component: SiteRoute,
});

function SiteRoute() {
  const { settings } = useSettings();
  const { user } = useAuth();
  // A equipe continua com acesso para conferir a loja durante a manutenção.
  const blocked = Boolean(settings?.maintenance_enabled) && user?.role !== "admin";

  return (
    <CartProvider>{blocked ? <MaintenanceScreen settings={settings} /> : <SiteLayout />}</CartProvider>
  );
}