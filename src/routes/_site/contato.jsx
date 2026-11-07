import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Mail, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEntityList, useSettings } from "@/lib/store";
import { useSiteContent } from "@/hooks/use-site-content";
import { serviceMessage, whatsappUrl } from "@/lib/contact";

export const Route = createFileRoute("/_site/contato")({
  validateSearch: (search) => ({ servico: typeof search?.servico === "string" ? search.servico : undefined }),
  head: () => ({
    meta: [
      { title: "Falar com a Paracolor" },
      { name: "description", content: "WhatsApp, e-mail e endereço da Paracolor para orçamentos, dúvidas e acompanhamento de pedidos." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { settings } = useSettings();
  const { content } = useSiteContent();
  const { servico } = Route.useSearch();
  const { data: services = [] } = useEntityList("Service", { active: true }, { sort: "sort" });
  const service = services.find((item) => item.id === servico);
  const message = serviceMessage(settings?.wa_template_contato, service?.title);
  const waLink = whatsappUrl(settings?.whatsapp, message);
  const mailLink = settings?.email
    ? `mailto:${settings.email}?subject=${encodeURIComponent(`Orçamento${service ? ` — ${service.title}` : ""}`)}&body=${encodeURIComponent(message)}`
    : "";

  return (
    <div className="container-x py-16">
      <p className="eyebrow">{content["page.contato.eyebrow"]}</p>
      <h1 className="mt-2 text-4xl">{content["page.contato.title"]}</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{content["page.contato.text"]}</p>

      {service ? (
        <div className="mt-8 max-w-xl rounded-[1.25rem] border border-primary/25 bg-accent/60 p-5">
          <p className="eyebrow">Assunto do contato</p>
          <p className="mt-1 font-display text-xl leading-snug">{service.title}</p>
          {service.short_description ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{service.short_description}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            O nome deste serviço vai junto na mensagem enviada para a equipe.
          </p>
        </div>
      ) : null}

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <div className="rounded-[1.25rem] border border-border bg-card p-6">
          <MessageCircle className="h-5 w-5 text-primary" strokeWidth={1.5} />
          <h2 className="mt-4 text-xl">WhatsApp</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {settings?.whatsapp ? content["page.contato.whatsapp_text"] : "O número ainda não foi cadastrado pela loja."}
          </p>
          {waLink ? (
            <Button asChild className="mt-4 rounded-full">
              <a href={waLink} target="_blank" rel="noreferrer">Abrir conversa</a>
            </Button>
          ) : null}
        </div>

        <div className="rounded-[1.25rem] border border-border bg-card p-6">
          <Mail className="h-5 w-5 text-primary" strokeWidth={1.5} />
          <h2 className="mt-4 text-xl">E-mail</h2>
          <p className="mt-1 text-sm text-muted-foreground">{content["page.contato.email_text"]}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {settings?.email || "A loja ainda não cadastrou o e-mail de atendimento."}
          </p>
          {mailLink ? (
            <Button asChild variant="outline" className="mt-4 rounded-full">
              <a href={mailLink}>Enviar e-mail</a>
            </Button>
          ) : null}
        </div>

        <div className="rounded-[1.25rem] border border-border bg-card p-6">
          <MapPin className="h-5 w-5 text-primary" strokeWidth={1.5} />
          <h2 className="mt-4 text-xl">Retirada na loja</h2>
          <p className="mt-1 text-sm text-muted-foreground">{settings?.address || "Endereço cadastrado no painel da loja."}</p>
          <p className="mt-2 text-xs text-muted-foreground">{settings?.pickup_info}</p>
        </div>

        <div className="rounded-[1.25rem] border border-border bg-card p-6">
          <Clock className="h-5 w-5 text-primary" strokeWidth={1.5} />
          <h2 className="mt-4 text-xl">Prazo de produção</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Em média {settings?.production_days || 3} dias úteis após a confirmação do pagamento
            {settings?.module_aprovacao_whatsapp ? " e a aprovação da arte, quando necessária." : "."}
          </p>
        </div>
      </div>
    </div>
  );
}