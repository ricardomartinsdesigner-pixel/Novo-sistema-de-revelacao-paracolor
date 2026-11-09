import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AuthGateError, requireSignedIn } from "@/components/auth/AuthGate";
import AdminMobileBar from "@/components/admin/AdminMobileBar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import OrderSoundControl from "@/components/admin/OrderSoundControl";
import { useAuth } from "@/lib/AuthContext";
import { adminPathPermission, hasStaffAccess } from "@/lib/staff-access";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: requireSignedIn,
  errorComponent: AuthGateError,
  component: AdminLayout,
});

function AdminLayout() {
  const { user, isLoadingAuth } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (isLoadingAuth) return null;
  if (user && !hasStaffAccess(user, adminPathPermission(pathname))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="card-glass max-w-sm p-8 text-center">
          <h1 className="text-2xl">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu nível de acesso não permite abrir esta área. Se precisar dela, peça a um administrador para ajustar suas permissões.
          </p>
          {hasStaffAccess(user, "orders") ? (
            <Link to="/admin/pedidos" className="mt-6 inline-block text-sm text-primary underline-offset-4 hover:underline">Ir para pedidos</Link>
          ) : (
            <Link to="/" className="mt-6 inline-block text-sm text-primary underline-offset-4 hover:underline">Voltar para a loja</Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col lg:flex-row">
        <AdminSidebar pathname={pathname} email={user?.email} user={user} />

        <div className="min-w-0 flex-1">
          <AdminMobileBar pathname={pathname} user={user} />

          <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            <div className="admin-content mx-auto w-full max-w-6xl">
              {hasStaffAccess(user, "orders") ? <OrderSoundControl key={user?.id} /> : null}
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
