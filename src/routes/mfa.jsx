import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LockKeyhole } from "lucide-react";

export const Route = createFileRoute("/mfa")({ ssr: false, component: MfaPage });

function MfaPage() {
  return <AuthLayout icon={LockKeyhole} title="Acesso protegido" subtitle="A autenticação em duas etapas será configurada na próxima etapa da migração para VPS.">
    <p className="text-sm text-muted-foreground">Entre com e-mail e senha. Configure uma senha forte para a conta administrativa.</p>
    <Link to="/login" className="mt-6 block text-center text-sm text-primary underline">Voltar ao login</Link>
  </AuthLayout>;
}
