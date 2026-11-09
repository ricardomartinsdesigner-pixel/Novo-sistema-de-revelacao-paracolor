import { Lock, Mail, UserPlus } from "lucide-react";
import { useRegistration } from "@/hooks/use-registration";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthError, AuthLink, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { safeReturnTo } from "@/lib/authReturnTo";

/**
 * The /register page supports immediate signup without email delivery and OTP confirmation when SMTP is enabled.
 */
export function RegisterPage({ managedAccount } = {}) {
  const returnTo = safeReturnTo();
  const {
    fullName, setFullName, phone, setPhone, address, setAddress, email, setEmail,
    password, setPassword, confirm, setConfirm, otpCode, setOtpCode,
    step, error, busy, register, verify, resend, finishManagedAccount,
  } = useRegistration(returnTo, managedAccount);
  const layoutProps = {
    icon: UserPlus,
    embedded: Boolean(managedAccount),
    title: managedAccount ? "Novo funcionário" : "Crie sua conta",
    subtitle: managedAccount
      ? "O funcionário escolhe a própria senha aqui no painel e confirma o código enviado ao e-mail. Sua sessão de administrador permanece aberta."
      : "Cadastre-se para começar",
  };

  if (managedAccount && (step === "existing" || step === "finish")) {
    return (
      <AuthLayout {...layoutProps}>
        <p className="mb-4 text-sm text-muted-foreground">
          {step === "existing"
            ? `O e-mail ${email} já possui uma conta. A senha existente será mantida; a senha digitada neste formulário não será aplicada.`
            : `E-mail ${email} confirmado. Conclua a liberação do acesso ao painel.`}
        </p>
        <AuthError>{error}</AuthError>
        <form onSubmit={(event) => { event.preventDefault(); finishManagedAccount(); }}>
          <SubmitButton busy={busy} busyLabel="Liberando acesso...">
            {step === "existing" ? "Liberar com a senha atual" : "Concluir cadastro"}
          </SubmitButton>
        </form>
      </AuthLayout>
    );
  }

  if (step === "already_verified") {
    return (
      <AuthLayout {...layoutProps}>
        <p className="mb-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{email}</span> já está verificada. Entre para continuar.
        </p>
        <AuthLink to="/login" returnTo={returnTo} className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Entrar
        </AuthLink>
      </AuthLayout>
    );
  }

  if (step === "otp") {
    return (
      <AuthLayout {...layoutProps}>
        <form onSubmit={verify}>
          <p className="mb-4 text-sm text-muted-foreground">
            Enviamos um código de 6 dígitos para <span className="font-medium text-foreground">{email}</span>.
          </p>
          <AuthError>{error}</AuthError>
          <div className="mb-6 flex justify-center">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <SubmitButton busy={busy} busyLabel="Verificando..." disabled={busy || otpCode.length < 6}>
            Verificar
          </SubmitButton>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Não recebeu o código?{" "}
            <button type="button" onClick={resend} disabled={busy} className="font-medium text-primary hover:underline disabled:opacity-50">
              Reenviar
            </button>
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...layoutProps}>
      <AuthError>{error}</AuthError>
      <form onSubmit={register} className="space-y-6">
        {!managedAccount && <div className="rounded-xl border border-gold/40 bg-gold-soft/60 px-3 py-2.5 text-[12px] leading-relaxed text-foreground/80">
          <strong className="text-foreground">Use seu nome completo</strong> (nome e sobrenome): ele é registrado no
          pedido e ajuda a localizar suas fotos na produção e na retirada.
        </div>}

        <fieldset className="space-y-4">
          <legend className="text-[10px] uppercase tracking-[0.18em] text-gold-deep">{managedAccount ? "Dados do funcionário" : "Seus dados"}</legend>
          <div className="space-y-2">
            <Label htmlFor="register-name">Nome completo</Label>
            <Input
              id="register-name"
              autoComplete="name"
              placeholder="Ex.: Maria Aparecida Souza"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12"
              autoFocus
              disabled={busy}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-phone">Telefone / WhatsApp</Label>
            <Input
              id="register-phone"
              type="tel"
              autoComplete="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12"
              disabled={busy}
              required={!managedAccount}
            />
          </div>
          {managedAccount?.fields?.(busy)}
          {!managedAccount && <div className="space-y-2">
            <Label htmlFor="register-address">
              Endereço <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="register-address"
              autoComplete="street-address"
              placeholder="Rua, número, complemento, bairro e cidade"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-12"
              disabled={busy}
            />
          </div>}
        </fieldset>

        <div className="gold-rule" />

        <fieldset className="space-y-4">
          <legend className="text-[10px] uppercase tracking-[0.18em] text-gold-deep">{managedAccount ? "Acesso do funcionário" : "Seu acesso"}</legend>
          <div className="space-y-2">
            <Label htmlFor="register-email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="register-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 pl-10" disabled={busy} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-password">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="register-password" type="password" autoComplete="new-password" minLength={8} maxLength={160} placeholder="Mínimo de 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10" disabled={busy} required />
            </div>
            <p className="text-[11px] text-muted-foreground">Use pelo menos 8 caracteres. Não precisa incluir maiúsculas ou símbolos.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-confirm">Confirmar senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="register-confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12 pl-10" disabled={busy} required />
            </div>
          </div>
        </fieldset>

        <SubmitButton busy={busy} busyLabel="Criando conta...">
          {managedAccount ? "Cadastrar senha e continuar" : "Criar conta"}
        </SubmitButton>

        {!managedAccount && <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Ao criar sua conta você concorda com os{" "}
          <a href="/termos" className="underline underline-offset-2 hover:text-foreground">termos de uso</a> e a{" "}
          <a href="/privacidade" className="underline underline-offset-2 hover:text-foreground">política de privacidade</a>.
        </p>}
      </form>
      {!managedAccount && <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <AuthLink to="/login" returnTo={returnTo}>
          Entrar
        </AuthLink>
      </p>}
      <p className="mt-3 text-center text-xs"><AuthLink to="/contato">Preciso de ajuda para acessar minha conta</AuthLink></p>
    </AuthLayout>
  );
}
