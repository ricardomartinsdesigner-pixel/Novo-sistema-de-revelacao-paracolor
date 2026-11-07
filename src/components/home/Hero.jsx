import { Fragment } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Star } from "lucide-react";
import { Image } from "@/components/ui/image";
import { formatBRL } from "@/lib/areas";
import { useEntityList } from "@/lib/store";
import { useAreas, useSiteContent } from "@/hooks/use-site-content";
import { Button } from "@/components/ui/button";

export default function Hero() {
  const { content } = useSiteContent();
  const areas = useAreas();
  const { data: sizes = [] } = useEntityList("PhotoSize", { active: true }, { sort: "sort", limit: 50 });

  const cheapest = sizes.reduce(
    (best, size) => (!best || Number(size.price) < Number(best.price) ? size : best),
    null
  );
  const polaroidCard = areas.find((area) => area.key === "polaroids");
  const printCard = areas.find((area) => area.key === "revelacao");
  const titleLines = (content["home.hero.title"] || "").split("\n");

  return (
    <section className="ink-panel relative overflow-hidden">
      <div className="gold-rule pointer-events-none absolute inset-x-0 top-0" />
      <div className="container-x relative grid items-center gap-14 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-white/[0.06] px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/75 backdrop-blur-md">
            <Star className="h-3 w-3 fill-[hsl(var(--gold-bright))] text-[hsl(var(--gold-bright))]" /> {content["home.hero.badge"]}
          </span>
          <h1 className="mt-6 text-[2.75rem] leading-[1.03] text-white sm:text-6xl lg:text-[4.25rem]">
            {titleLines.map((line, index) => (
              <Fragment key={index}>
                {index > 0 ? <br /> : null}
                {line}
              </Fragment>
            ))}{" "}
            <em className="italic text-[hsl(var(--gold-bright))]">{content["home.hero.highlight"]}</em>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/65">{content["home.hero.subtitle"]}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full border-2 border-background bg-background px-7 font-semibold text-foreground shadow-[0_18px_44px_-12px_rgba(0,0,0,0.85)] ring-1 ring-gold/50 hover:border-gold-bright hover:bg-gold-bright hover:text-ink"
            >
              <Link to="/revelar">
                Revelar minhas fotos
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-white/40 bg-white/10 px-6 text-white backdrop-blur-md hover:bg-white/10 hover:text-white"
            >
              <Link to="/polaroids">Ver polaroids</Link>
            </Button>
          </div>
          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-6 text-sm">
            {[1, 2, 3].map((index) => (
              <div key={index}>
                <dt className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                  {content[`home.hero.meta${index}_label`]}
                </dt>
                <dd className="mt-1 font-medium text-white">{content[`home.hero.meta${index}_value`]}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative animate-fade-in">
          {printCard ? (
            <div className="paper absolute -right-5 -top-7 hidden w-28 rotate-[6deg] rounded-sm border border-white/40 bg-card p-1.5 sm:block">
              <Image
                src={printCard.image}
                alt="Foto revelada em papel fotográfico"
                className="aspect-[4/3] w-full rounded-[2px] object-cover"
                fittingType="fill"
              />
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-[1.25rem] border border-white/15 shadow-[0_60px_120px_-60px_rgba(0,0,0,0.9)]">
            <Image
              src={content["home.hero.image"]}
              alt="Foto impressa recém-revelada, em luz de fim de tarde"
              className="aspect-[4/5] w-full object-cover sm:aspect-[16/13]"
              fittingType="fill"
            />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
            {cheapest ? (
              <div className="glass-dark absolute bottom-4 right-4 rounded-xl px-4 py-3 text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                  Impressão {cheapest.name}
                </p>
                <p className="font-display text-lg leading-tight text-white">
                  a partir de {formatBRL(cheapest.price)}
                </p>
              </div>
            ) : null}
          </div>

          {polaroidCard ? (
            <div className="paper absolute -bottom-8 -left-6 hidden w-24 rotate-[-7deg] rounded-sm border border-white/40 bg-card p-1.5 sm:block">
              <Image
                src={polaroidCard.image}
                alt="Polaroid impressa com moldura branca"
                className="aspect-square w-full rounded-[2px] object-cover"
                fittingType="fill"
              />
              <div className="h-4" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}