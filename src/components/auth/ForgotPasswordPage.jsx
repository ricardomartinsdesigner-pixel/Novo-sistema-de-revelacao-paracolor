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
  const [result, setResult] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const response = await base44.auth.resetPasswordRequest(email);
      setResult(response.available === false ? "unavailable" : "requested");
    } catch {
      setResult("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout icon={Mail} title="Recuperar senha" subtitle="Enviaremos um link para você redefinir">
      {result ? (
        <div role="status" className="rounded-lg bg-accent/60 p-3 text-center text-sm">
          {result === "unavailable" ? "A recuperação por e-mail está indisponível. Fale com a loja para recuperar o acesso."
            : result === "error" ? "Não foi possível concluir a solicitação agora. Tente novamente ou fale com a loja."
            : "Se houver uma conta com esse e-mail, procure o link na caixa de entrada e no spam."}
          <button type="button" className="mx-auto mt-2 block text-xs text-primary underline" onClick={() => setResult("")}>Voltar ao formulário</button>
        </div>
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
      <p className="mt-5 text-center text-sm"><AuthLink to="/contato">Falar com a loja sobre meu acesso</AuthLink></p>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <AuthLink to="/login" returnTo={returnTo}>
          <ArrowLeft className="mr-1 inline h-3 w-3" aria-hidden="true" />
          Voltar para o login
        </AuthLink>
      </p>
    </AuthLayout>
  );
}