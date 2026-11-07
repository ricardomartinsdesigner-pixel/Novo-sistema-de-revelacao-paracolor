import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmailSettings from "@/components/admin/EmailSettings";
import SmtpSettings from "@/components/admin/SmtpSettings";
import { useSettingsForm } from "@/hooks/use-settings-form";

export const Route = createFileRoute("/admin/mensagens")({
  head: () => ({ meta: [{ title: "Mensagens — Paracolor" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const { form, setForm, saving, save, isLoading } = useSettingsForm((settings) => ({
    wa_template_arte: settings.wa_template_arte || "",
    wa_template_contato: settings.wa_template_contato || "",
  }));

  if (isLoading || !form) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Loja</p>
        <h1 className="mt-1 text-3xl">Mensagens</h1>
        <p className="mt-1 text-xs text-muted-foreground">E-mails automáticos e modelos de WhatsApp usados no atendimento.</p>
      </div>

      <EmailSettings />
      <SmtpSettings />

      <section className="card-glass p-5">
        <h2 className="text-lg">WhatsApp</h2>
        <p className="mt-1 text-xs text-muted-foreground">Use {"{pedido}"} e {"{cliente}"} para preencher automaticamente.</p>
        <label className="mt-4 block text-xs text-muted-foreground">
          Modelo de envio de arte
          <textarea
            value={form.wa_template_arte}
            onChange={(event) => setForm({ ...form, wa_template_arte: event.target.value })}
            rows={4}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="mt-4 block text-xs text-muted-foreground">
          Modelo de contato
          <textarea
            value={form.wa_template_contato}
            onChange={(event) => setForm({ ...form, wa_template_contato: event.target.value })}
            rows={3}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <Button onClick={save} disabled={saving} className="mt-4">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
        </Button>
      </section>
    </div>
  );
}