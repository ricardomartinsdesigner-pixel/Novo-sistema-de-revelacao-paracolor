import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettingsForm } from "@/hooks/use-settings-form";

const inputClass = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";

const NOTIFICATIONS = [
  { key: "notify_order_created", label: "Pedido recebido" },
  { key: "notify_payment_approved", label: "Pagamento aprovado" },
  { key: "notify_art_ready", label: "Arte pronta para aprovação" },
  { key: "notify_order_ready", label: "Pedido pronto" },
  { key: "notify_shipped", label: "Pedido enviado" },
];

export default function EmailSettings() {
  const { form, setForm, saving, save, isLoading } = useSettingsForm((settings) => ({
    email_enabled: settings.email_enabled !== false,
    email_from_name: settings.email_from_name || "",
    email_reply_to: settings.email_reply_to || "",
    notify_order_created: settings.notify_order_created !== false,
    notify_payment_approved: settings.notify_payment_approved !== false,
    notify_art_ready: settings.notify_art_ready !== false,
    notify_order_ready: settings.notify_order_ready !== false,
    notify_shipped: settings.notify_shipped !== false,
  }));

  if (isLoading || !form) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>;
  }

  return (
    <section className="card-glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg"><Mail className="h-4 w-4" /> E-mails da loja</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Os avisos serão enviados exclusivamente pelo servidor SMTP configurado abaixo. Defina o nome do remetente e quais avisos o cliente recebe.
          </p>
        </div>
        <Switch
          checked={form.email_enabled}
          onCheckedChange={(checked) => setForm({ ...form, email_enabled: checked })}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Nome do remetente
          <input
            value={form.email_from_name}
            onChange={(event) => setForm({ ...form, email_from_name: event.target.value })}
            placeholder="Paracolor"
            className={inputClass}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          E-mail para respostas
          <input
            value={form.email_reply_to}
            onChange={(event) => setForm({ ...form, email_reply_to: event.target.value })}
            placeholder="suporte@paracolor.com.br"
            className={inputClass}
          />
        </label>
      </div>

      <p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Avisos automáticos ao cliente</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {NOTIFICATIONS.map((item) => (
          <label key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            {item.label}
            <Switch
              checked={form[item.key]}
              onCheckedChange={(checked) => setForm({ ...form, [item.key]: checked })}
              disabled={!form.email_enabled}
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          Sem configuração SMTP válida, os avisos não são enviados por outro serviço.
        </p>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Salvar
          </Button>
        </div>
      </div>
    </section>
  );
}