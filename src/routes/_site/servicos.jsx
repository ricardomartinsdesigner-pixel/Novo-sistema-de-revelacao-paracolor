import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, MessageCircle, Sparkles } from "lucide-react";
import ModuleUnavailable from "@/components/site/ModuleUnavailable";
import ServiceCard from "@/components/services/ServiceCard";
import { Button } from "@/components/ui/button";
import { moduleEnabled, useEntityList, useSettings } from "@/lib/store";
import { useSiteContent } from "@/hooks/use-site-content";

export const Route = createFileRoute("/_site/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços prestados — Paracolor" },
      {
        name: "description",
        content:
          "Veja os serviços prestados pela Paracolor e fale com a equipe para solicitar orçamento ou mais informações.",
      },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { settings, isLoading: settingsLoading } = useSettings();
  const { content } = useSiteContent();
  const query = useEntityList("Service", { active: true, image_authorized: true }, { sort: "sort" });
  const services = query.data || [];

  // Agrupar por categoria dá ritmo editorial à página sem mudar o cadastro dos serviços.
  const groups = useMemo(() => {
    const map = new Map();
    services.forEach((service) => {
      const key = service.category || "Outros serviços";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(service);
    });
    return Array.from(map.entries());
  }, [services]);

  if (!settingsLoading && !moduleEnabled(settings, "servicos")) {
    return <ModuleUnavailable title="O catálogo de serviços está fora do ar" />;
  }

  return (
    <div>
      <section className="band-gold border-b border-border/70">
        <div className="container-x py-12 sm:py-16">
          <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="eyebrow">{content["page.servicos.eyebrow"]}</p>
              <h1 className="mt-3 max-w-2xl text-4xl leading-[1.05] sm:text-5xl">
                {content["page.servicos.title"]}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {content["page.servicos.text"]}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild className="gap-2 rounded-full">
                  <Link to="/contato">
                    <MessageCircle className="h-4 w-4" /> Pedir orçamento
                  </Link>
                </Button>
                {services.length ? (
                  <span className="text-xs text-muted-foreground">
                    {services.length} serviço(s) disponível(is)
                  </span>
                ) : null}
              </div>
            </div>

            <div className="hidden rounded-[1.25rem] border border-gold/40 bg-card/80 p-6 lg:block">
              <Sparkles className="h-5 w-5 text-gold-deep" strokeWidth={1.4} />
              <p className="mt-3 font-display text-xl leading-snug">{content["page.servicos.card_title"]}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {content["page.servicos.card_text"]}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-x py-10 sm:py-14">
        {query.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando serviços…
          </p>
        ) : query.isError ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm">
            <p className="text-muted-foreground">Não foi possível carregar os serviços agora.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : groups.length ? (
          <div className="space-y-12">
            {groups.map(([category, items]) => (
              <div key={category}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/80 pb-3">
                  <h2 className="text-2xl leading-tight">{category}</h2>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {items.length} serviço(s)
                  </span>
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((service) => (
                    <ServiceCard key={service.id} service={service} settings={settings} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-border bg-card p-10 text-center">
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              {content["page.servicos.empty"]}
            </p>
          </div>
        )}

        <div className="mt-14 flex flex-col items-start gap-4 rounded-[1.25rem] bg-secondary/60 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">{content["page.servicos.note"]}</p>
          <Button asChild className="gap-2 rounded-full">
            <Link to="/contato">
              <MessageCircle className="h-4 w-4" /> Falar com a equipe
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}