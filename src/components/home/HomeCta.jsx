import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { useAreas, useSiteContent } from "@/hooks/use-site-content";

export default function HomeCta() {
  const { content } = useSiteContent();
  const areas = useAreas();
  const cards = [areas[0], areas[1], areas[3]].filter(Boolean);

  return (
    <section className="ink-panel relative overflow-hidden border-t border-gold/25 py-20">
      <div className="container-x relative grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="eyebrow !text-[hsl(var(--gold-bright))]">{content["home.cta.eyebrow"]}</p>
          <h2 className="mt-3 text-4xl leading-tight text-white sm:text-5xl">{content["home.cta.title"]}</h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">{content["home.cta.text"]}</p>
          <div className="mt-8 flex flex-wrap gap-3">
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
              className="rounded-full border-white/40 bg-white/10 px-6 text-white backdrop-blur-md hover:border-white/70 hover:bg-white/20 hover:text-white"
            >
              <Link to="/contato">Falar com a loja</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {cards.map((area, index) => (
            <div
              key={area.key}
              className={`rounded-md border border-border/60 bg-card p-1.5 paper ${index === 1 ? "mt-6" : ""}`}
            >
              <Image
                src={area.image}
                alt={area.label}
                className="aspect-[3/4] w-full rounded-[2px] object-cover"
                fittingType="fill"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}