import { Link } from "@tanstack/react-router";
import { ArrowRight, ImageIcon } from "lucide-react";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/areas";
import { serviceMessage, whatsappUrl } from "@/lib/contact";

/** Cartão de um serviço do catálogo, com o caminho de contato escolhido no painel. */
export default function ServiceCard({ service, settings }) {
  const photo = service.image_url || service.photos?.[0]?.url || "";
  const alt = service.image_alt || service.photos?.[0]?.alt || service.title;
  const label = service.button_label || "Solicitar orçamento";
  const showPrice = Number(service.price) > 0 && service.price_confirmed;
  const wa = whatsappUrl(settings?.whatsapp, serviceMessage(settings?.wa_template_contato, service.title));
  const mail = settings?.email
    ? `mailto:${settings.email}?subject=${encodeURIComponent(`Orçamento — ${service.title}`)}&body=${encodeURIComponent(
        serviceMessage(settings?.wa_template_contato, service.title)
      )}`
    : "";

  const action = service.contact_action === "whatsapp" && wa ? "whatsapp" : service.contact_action === "email" && mail ? "email" : "page";

  return (
    <article className="card-hover group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-border bg-card">
      <div className="relative aspect-[4/3] w-full bg-secondary">
        {photo ? (
          <Image
            src={photo}
            alt={alt}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            fittingType="fill"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground" aria-hidden="true">
            <ImageIcon className="h-7 w-7" strokeWidth={1.2} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {service.category ? <p className="eyebrow">{service.category}</p> : null}
        <h2 className="mt-1.5 text-xl leading-snug">{service.title}</h2>
        {service.short_description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{service.short_description}</p>
        ) : null}
        {showPrice ? <p className="mt-3 font-display text-xl">{formatBRL(service.price)}</p> : null}
        <div className="mt-auto pt-5">
          {action === "whatsapp" ? (
            <Button asChild className="w-full gap-2 rounded-full">
              <a href={wa} target="_blank" rel="noreferrer">
                {label} <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          ) : action === "email" ? (
            <Button asChild className="w-full gap-2 rounded-full">
              <a href={mail}>
                {label} <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button asChild className="w-full gap-2 rounded-full">
              <Link to="/contato" search={{ servico: service.id }}>
                {label} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}