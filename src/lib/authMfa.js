import { base44 } from "@/api/base44Client";

export async function loginWithMfa(email, password) {
  return base44.auth.login({ email, password });
}

export async function continueMfa() {
  throw new Error("A autenticação em duas etapas ainda não está disponível na versão VPS.");
}

// provider: "google" | "microsoft" | "facebook" | "apple"
export async function loginWithSocial(provider, returnTo) {
  return base44.auth.loginWithProvider(provider, returnTo);
}

export function loginWithGoogle(returnTo) {
  return loginWithSocial("google", returnTo);
}
