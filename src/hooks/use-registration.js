import { useState } from "react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { continueMfa } from "@/lib/authMfa";
import { isAllowedCustomerPassword } from "@/lib/password-policy";

const isAlreadyVerified = (error) => error?.status === 400 && /already verified/i.test(error?.message ?? "");

// The same platform registration flow serves the public page and supervised staff setup.
export function useRegistration(returnTo, managedAccount) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const profile = () => ({ name: fullName.trim(), email: email.trim().toLowerCase(), phone: phone.trim() });

  async function finishManagedAccount() {
    setError("");
    setBusy(true);
    try {
      await managedAccount.onComplete(profile());
    } catch (err) {
      setError(err.message || "Não foi possível liberar o acesso. Tente concluir novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function register(event) {
    event.preventDefault();
    setError("");
    if (fullName.trim().split(/\s+/).filter(Boolean).length < 2) {
      setError("Informe o nome completo (nome e sobrenome).");
      return;
    }
    if (!phone.trim() && !managedAccount) {
      setError("Informe um telefone para contato.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem");
      return;
    }
    if (!isAllowedCustomerPassword(password)) {
      setError("A senha precisa ter de 8 a 160 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const existing = managedAccount && await managedAccount.beforeRegister(profile());
      if (existing?.exists) {
        setPassword("");
        setConfirm("");
        setStep("existing");
        return;
      }
      const result = await base44.auth.register({
        email: profile().email,
        password,
        full_name: fullName.trim(),
        managed_account: Boolean(managedAccount),
      });
      setPassword("");
      setConfirm("");
      if (result?.verification_required === false && !managedAccount) {
        await saveProfile();
        toast("Cadastro concluído", { description: "Você já pode acessar sua conta. A confirmação por e-mail ficará disponível quando o envio for ativado." });
        window.location.href = returnTo;
        return;
      }
      setStep("otp");
    } catch (err) {
      setError(err.message || "Não foi possível criar a conta");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    try {
      await base44.auth.updateMe({ full_name: fullName.trim(), phone: phone.trim(), address: address.trim() });
    } catch {
      // The account is valid; the customer can confirm profile details at checkout.
    }
  }

  async function verify(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await base44.auth.verifyOtp({ email: profile().email, otpCode });
      if (managedAccount) {
        // verifyOtp returns a token but does not install it. Never replace the admin's session.
        // No password or employee token is sent to the team-management operation.
        setOtpCode("");
        setStep("finish");
        await finishManagedAccount();
        return;
      }
      if (result?.mfa_required) {
        await continueMfa(result, returnTo).catch(() => {
          setStep("already_verified");
          setBusy(false);
        });
        return;
      }
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
        await saveProfile();
      }
      window.location.href = returnTo;
    } catch (err) {
      if (isAlreadyVerified(err)) setStep(managedAccount ? "existing" : "already_verified");
      else setError(err.message || "Código de verificação inválido");
      setBusy(false);
    }
  }

  async function resend() {
    setError("");
    setBusy(true);
    try {
      await base44.auth.resendOtp(profile().email);
      toast("Código enviado", { description: "Confira seu e-mail para ver o novo código." });
    } catch (err) {
      if (isAlreadyVerified(err)) setStep(managedAccount ? "existing" : "already_verified");
      else setError(err.message || "Não foi possível reenviar o código");
    } finally {
      setBusy(false);
    }
  }

  return {
    fullName, setFullName, phone, setPhone, address, setAddress, email, setEmail,
    password, setPassword, confirm, setConfirm, otpCode, setOtpCode,
    step, error, busy, register, verify, resend, finishManagedAccount,
  };
}
