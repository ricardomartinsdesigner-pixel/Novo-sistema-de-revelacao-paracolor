import { Clock, Mail, MessageCircle } from "lucide-react";

export default function MaintenanceScreen({ settings }) {
  const title = settings?.maintenance_title || "Estamos preparando novidades";
  const message =
    settings?.maintenance_message ||
    "Nossa loja está em manutenção e volta em instantes. Se precisar falar com a gente agora, é só chamar.";
  const store = settings?.store_name || "Paracolor";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/40 px-5 py-16">
      <div className="w-full max-w-lg rounded-[1.25rem] border border-border bg-card p-8 text-center soft-shadow animate-fade-up sm:p-12">
        <p className="font-display text-2xl leading-none">{store}</p>
        <p className="eyebrow mt-2">Loja em manutenção</p>
        <h1 className="mt-6 text-3xl leading-tight">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{message}</p>

        {settings?.maintenance_return && (
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs text-accent-foreground">
            <Clock className="h-3.5 w-3.5" /> Previsão de retorno: {settings.maintenance_return}
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {settings?.whatsapp && (
            <a
              href={`https://wa.me/${String(settings.whatsapp).replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition hover:bg-secondary"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          {settings?.email && (
            <a
              href={`mailto:${settings.email}`}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition hover:bg-secondary"
            >
              <Mail className="h-4 w-4" /> {settings.email}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}