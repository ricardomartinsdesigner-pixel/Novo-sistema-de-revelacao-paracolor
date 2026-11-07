import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { useEntityList, useSettings } from "@/lib/store";
import ShippingEstimate from "@/components/site/ShippingEstimate";
import PolaroidModelPreview from "@/components/polaroids/PolaroidModelPreview";
import { formatDeadlineDuration } from "@/lib/deadline";
import { formatBRL } from "@/lib/areas";
import { useAreas, useSiteContent } from "@/hooks/use-site-content";

export const Route = createFileRoute("/_site/polaroids")({
  head: () => ({
    meta: [
      { title: "Polaroids com legenda — Paracolor" },
      { name: "description", content: "Polaroids com moldura branca e legenda escrita na prévia, impressas exatamente como você montou." },
    ],
  }),
  component: PolaroidsPage,
});

function PolaroidsPage() {
  const area = useAreas().find((item) => item.key === "polaroids");
  const { content } = useSiteContent();
  const { settings } = useSettings();
  const { data: models = [] } = useEntityList("PolaroidModel", { active: true }, { sort: "sort" });

  return (
    <div>
      <section className="band-gold border-b border-border/70">
        <div className="container-x grid items-center gap-10 py-14 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="eyebrow">{content["page.polaroids.eyebrow"]}</p>
            <h1 className="mt-3 text-5xl leading-[1.05]">{content["page.polaroids.title"]}</h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
              {content["page.polaroids.text"]}
            </p>
            <Button asChild size="lg" className="mt-7 rounded-full">
              <Link to="/polaroids/criar">{content["page.polaroids.cta"]} <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <p className="mt-5 text-xs text-muted-foreground">
              Prazo de produção: <strong className="text-foreground">{formatDeadlineDuration(settings, "polaroid")}</strong> após a confirmação do pagamento
            </p>
            <ShippingEstimate />
          </div>
          <Image
            src={area.image}
            alt="Polaroids com legendas sobre uma mesa de madeira"
            className="aspect-[4/3] w-full rounded-[1.25rem] object-cover paper"
            fittingType="fill"
          />
        </div>
      </section>

      <section className="container-x py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl">{content["page.polaroids.list_title"]}</h2>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            {content["page.polaroids.list_note"]}
          </p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <div key={model.id} className="rounded-[1.25rem] border border-border bg-card p-5 card-hover">
              <div className="flex items-center justify-center rounded-[1rem] bg-secondary/50 px-4 py-8">
                <PolaroidModelPreview model={model} maxWidth={210} />
              </div>
              <div className="mt-5 flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl">{model.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {model.width_cm} × {model.height_cm} cm ·{" "}
                    {model.has_caption === false ? "sem área de escrita" : "com área para legenda"}
                  </p>
                </div>
                <p className="whitespace-nowrap text-sm font-medium text-primary">{formatBRL(model.price)}</p>
              </div>
            </div>
          ))}
          {!models.length && <p className="text-sm text-muted-foreground">Os modelos estão sendo configurados pela loja.</p>}
        </div>
      </section>
    </div>
  );
}
