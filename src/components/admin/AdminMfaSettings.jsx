import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

export default function AdminMfaSettings() {
  const { user, refresh } = useAuth();
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState([]);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (setup) {
        const result = await base44.auth.confirmAdminMfa(code);
        setSetup(null);
        setCode("");
        setCodes(result.codes);
        await refresh();
      } else {
        const result = await base44.auth.beginAdminMfa(password);
        setPassword("");
        const { default: QR } = await import("qrcode");
        setSetup({ secret: result.secret, image: await QR.toDataURL(result.uri, { width: 200, margin: 2 }) });
      }
    } catch (error) { toast.error(error.message || "Não foi possível configurar a proteção."); }
    finally { setBusy(false); }
  }

  return <section className="mt-4 rounded-xl border border-border bg-card p-4">
    <h3 className="font-medium">Autenticação em duas etapas</h3>
    {user?.admin_mfa_enabled ? <p className="mt-1 text-sm">Ativa para a sua conta administrativa.</p> : (
      <form className="mt-2 max-w-md space-y-3" onSubmit={submit}>
        <p className="text-sm text-muted-foreground">Use um aplicativo autenticador para proteger seu acesso e ativar integrações em produção.</p>
        {setup ? <>
          <img src={setup.image} alt="QR Code para configurar o autenticador" width="200" height="200" />
          <p className="text-xs">Chave para configuração manual <code className="break-all">{setup.secret}</code></p>
          <label className="block text-sm">Código de seis dígitos
            <Input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
          </label>
        </> : <label className="block text-sm">Confirme sua senha
          <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>}
        <Button size="sm" type="submit" disabled={busy}>{setup ? "Ativar proteção" : "Gerar QR Code"}</Button>
      </form>
    )}
    {codes.length > 0 && <div className="mt-3 rounded-lg border border-gold p-3 text-sm">
      <p>Guarde estes códigos em um local seguro. Cada um pode ser usado uma vez.</p>
      <ul className="my-2 space-y-1 font-mono">{codes.map((value) => <li key={value}>{value}</li>)}</ul>
      <Button size="sm" variant="outline" onClick={() => setCodes([])}>Já guardei os códigos</Button>
    </div>}
  </section>;
}
