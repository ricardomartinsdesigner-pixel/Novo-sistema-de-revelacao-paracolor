import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AuthGateError, requireSignedIn } from "@/components/auth/AuthGate";
import AdminMobileBar from "@/components/admin/AdminMobileBar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import RetentionRunner from "@/components/admin/RetentionRunner";
import { useAuth } from "@/lib/AuthContext";

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
  if (user && user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="card-glass max-w-sm p-8 text-center">
          <h1 className="text-2xl">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é exclusiva da equipe da Paracolor. Fale com um administrador para liberar o acesso.
          </p>
          <Link to="/" className="mt-6 inline-block text-sm text-primary underline-offset-4 hover:underline">
            Voltar para a loja
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col lg:flex-row">
        <AdminSidebar pathname={pathname} email={user?.email} />

        <div className="min-w-0 flex-1">
          <AdminMobileBar pathname={pathname} />

          <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            <div className="admin-content mx-auto w-full max-w-6xl">
              <RetentionRunner />
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}