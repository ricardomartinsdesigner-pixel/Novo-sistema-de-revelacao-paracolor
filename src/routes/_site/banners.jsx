import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileCheck2, Ruler, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { useEntityList, useSettings } from "@/lib/store";
import { daysForArea } from "@/lib/deadline";
import { formatBRL } from "@/lib/areas";
import { useAreas, useSiteContent } from "@/hooks/use-site-content";

export const Route = createFileRoute("/_site/banners")({
  head: () => ({
    meta: [
      { title: "Banners e lonas — Paracolor" },
      { name: "description", content: "Lonas, banners promocionais e faixas em qualquer tamanho, com materiais e acabamentos." },
    ],
  }),
  component: BannersPage,
});

const HIGHLIGHTS = [
  { icon: Ruler, title: "Tamanho personalizado", text: "Informe largura e altura; o preço é calculado por m²." },
  { icon: FileCheck2, title: "Envie sua arte", text: "Validamos formato, proporção e resolução antes de imprimir." },
  { icon: Truck, title: "Produção acompanhada", text: "Você acompanha cada etapa do pedido pelo site." },
];

function BannersPage() {
  const area = useAreas().find((item) => item.key === "banners");
  const { content } = useSiteContent();
  const { settings } = useSettings();
  const { data: sizes = [] } = useEntityList("BannerSize", { active: true }, { sort: "sort" });

  return (
    <div>
      <section className="band-gold border-b border-border/70">
        <div className="container-x grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div>
            <p className="eyebrow">{content["page.banners.eyebrow"]}</p>
            <h1 className="mt-3 text-4xl leading-[1.05] sm:text-5xl">{content["page.banners.title"]}</h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
              {content["page.banners.text"]}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/banners/pedido">
                  Montar meu banner <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <span className="text-xs text-muted-foreground">
                Produção em <strong className="text-foreground">{daysForArea(settings, "banner")} dias úteis</strong>
              </span>
            </div>
          </div>

          {area?.image ? (
            <Image
              src={area.image}
              alt="Banner impresso na fachada de uma loja"
              className="aspect-[4/3] w-full rounded-[1.25rem] object-cover paper"
              fittingType="fill"
            />
          ) : null}
        </div>
      </section>

      <section className="container-x py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{content["page.banners.list_eyebrow"]}</p>
            <h2 className="mt-2 text-3xl leading-tight">{content["page.banners.list_title"]}</h2>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {content["page.banners.list_note"]}
          </p>
        </div>

        {sizes.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sizes.map((size) => (
              <div key={size.id} className="card-hover flex h-full flex-col rounded-[1.25rem] border border-border bg-card p-5">
                <p className="font-display text-2xl leading-none">
                  {size.width_cm} <span className="text-muted-foreground">×</span> {size.height_cm}
                  <span className="ml-1 text-sm text-muted-foreground">cm</span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{size.name}</p>
                {size.description ? (
                  <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {size.description}
                  </p>
                ) : null}
                <p className="mt-auto pt-4 text-sm font-medium text-gold-deep">
                  a partir de {formatBRL(size.base_price)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-[1.25rem] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            {content["page.banners.empty"]}
          </p>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-6">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="rounded-[1.25rem] border border-border bg-card p-6">
              <item.icon className="h-5 w-5 text-gold-deep" strokeWidth={1.5} />
              <p className="mt-4 font-display text-xl leading-snug">{item.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start gap-4 rounded-[1.25rem] bg-secondary/60 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-gold-deep" strokeWidth={1.4} />
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              {content["page.banners.cta_text"]}
            </p>
          </div>
          <Button asChild className="rounded-full">
            <Link to="/banners/pedido">
              Fazer orçamento <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}