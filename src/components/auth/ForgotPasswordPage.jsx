import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLink, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeReturnTo } from "@/lib/authReturnTo";

// The /forgot-password page. Always ends in the generic "if an account exists"
// message: the API does not reveal whether the email is registered, and neither should the UI.
export function ForgotPasswordPage() {
  const returnTo = safeReturnTo();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {
      // Same outcome either way.
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <AuthLayout icon={Mail} title="Recuperar senha" subtitle="Enviaremos um link para você redefinir">
      {sent ? (
        <p className="text-center text-sm text-foreground">Se existir uma conta com este e-mail, você receberá um link de redefinição em instantes.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="forgot-email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 pl-10" required />
            </div>
          </div>
          <SubmitButton busy={busy} busyLabel="Enviando...">
            Enviar link de redefinição
          </SubmitButton>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <AuthLink to="/login" returnTo={returnTo}>
          <ArrowLeft className="mr-1 inline h-3 w-3" aria-hidden="true" />
          Voltar para o login
        </AuthLink>
      </p>
    </AuthLayout>
  );
}