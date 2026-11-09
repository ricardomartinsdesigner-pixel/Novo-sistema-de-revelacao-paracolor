import { Loader2, Server, Send } from "lucide-react";
import { formatDate } from "@/lib/areas";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import SmtpFields from "@/components/admin/SmtpFields";
import { useSmtpSettings } from "@/hooks/use-smtp-settings";

export default function SmtpSettings() {
  const { form, setForm, submit, toggleEnabled, toggling, testing, saving, loading, error, reload } = useSmtpSettings();
  const busy = saving || testing || toggling;
  return (
    <section className="card-glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg"><Server className="h-4 w-4" /> Serviço SMTP</h2>
          <p className="mt-1 text-xs text-muted-foreground">Configure o servidor que fará os envios da loja. Desativado, nenhum e-mail sai pelo sistema; os dados configurados ficam salvos.</p>
        </div>
        {form ? (
          <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
            <span>{form.enabled ? "Ativado" : "Desativado"}</span>
            <Switch checked={form.enabled} onCheckedChange={toggleEnabled} disabled={busy || loading} aria-label="Ativar ou desativar serviço SMTP" />
          </label>
        ) : null}
      </div>
      {loading ? <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando SMTP…</p> : null}
      {form ? (
        <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <SmtpFields form={form} setForm={setForm} disabled={busy} />
          <p className="mt-3 text-xs text-muted-foreground">A senha salva não é exibida novamente neste formulário; deixe o campo vazio para mantê-la. Apenas administradores podem gerenciar estes dados. Não é permitido envio sem criptografia nem pela porta 25.</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy || !form.enabled} onClick={(event) => { if (event.currentTarget.form.reportValidity()) submit(true); }}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Salvar e enviar teste
            </Button>
            <Button type="submit" disabled={busy}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar SMTP</Button>
          </div>
          <p className="mt-2 text-right text-[11px] text-muted-foreground">O teste é enviado ao e-mail remetente configurado acima.</p>
        </form>
      ) : null}
      {form?.last_test && <p className="mt-2 text-xs text-muted-foreground">Último teste {formatDate(form.last_test.at)} · {form.last_test.status}</p>}
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
      {!loading && !form && error ? <Button variant="outline" className="mt-3" onClick={() => reload()}>Tentar novamente</Button> : null}
    </section>
  );
}
