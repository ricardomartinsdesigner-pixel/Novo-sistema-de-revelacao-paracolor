import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { AuthLayout } from "./AuthLayout";

// Signed in to Base44, but not a user of this app (invite-only apps).
export function UserNotRegistered() {
  const { logout } = useAuth();
  return (
    <AuthLayout icon={UserX} title="Acesso não liberado" subtitle="Sua conta não está registrada nesta loja.">
      <p className="mb-6 text-center text-sm text-foreground">Peça um convite à Paracolor ou entre com outra conta.</p>
      <Button variant="outline" className="h-12 w-full font-medium" onClick={logout}>
        Sair
      </Button>
    </AuthLayout>
  );
}