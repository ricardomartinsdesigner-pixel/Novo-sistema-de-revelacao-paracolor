import { Fragment } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Star } from "lucide-react";
import { Image } from "@/components/ui/image";
import { useSiteContent } from "@/hooks/use-site-content";
import { Button } from "@/components/ui/button";

export default function Hero() {
  const { content } = useSiteContent();
  const titleLines = (content["home.hero.title"] || "").split("\n");
  const sealOuterText = content["home.hero.seal_outer_text"] || "PARACOLOR · DESDE 1994";
  const sealYear = content["home.hero.seal_year"] || "1994";

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
          <svg
            viewBox="0 0 150 150"
            role="img"
            aria-label={sealOuterText.replace(/[·•]/g, " ").trim()}
            className="pointer-events-none absolute -right-1 -top-4 z-10 h-20 w-20 sm:-right-3 sm:-top-5 sm:h-24 sm:w-24 lg:-right-5 lg:-top-6 lg:h-28 lg:w-28"
          >
            <defs>
              <path id="home-since-seal-path" d="M75 75m-56 0a56 56 0 1 1 112 0a56 56 0 1 1-112 0" />
            </defs>
            <g className="anim-seal-spin" style={{ transformOrigin: "75px 75px" }}>
              <circle cx="75" cy="75" r="72" fill="rgba(11,11,11,.72)" stroke="#C9A24A" />
              <text fill="#C9A24A" fontFamily="system-ui,sans-serif" fontSize={sealOuterText.length > 34 ? 7 : sealOuterText.length > 28 ? 8 : 10} letterSpacing="3.5">
                <textPath href="#home-since-seal-path">{sealOuterText} · </textPath>
              </text>
            </g>
            <circle cx="75" cy="75" r="40" fill="rgba(11,11,11,.72)" stroke="#6E5A2E" />
            <text x="75" y="75" textAnchor="middle" dominantBaseline="central" fill="#C9A24A" fontFamily="Inter,system-ui,sans-serif" fontSize={sealYear.length > 5 ? 13 : 18} fontWeight="700">{sealYear}</text>
          </svg>
          <div className="relative overflow-hidden rounded-[1.25rem] border border-white/15 shadow-[0_60px_120px_-60px_rgba(0,0,0,0.9)]">
            <Image
              src={content["home.hero.image"]}
              alt="Foto impressa recém-revelada, em luz de fim de tarde"
              className="aspect-[4/5] w-full object-cover sm:aspect-[16/13]"
              fittingType="fill"
            />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
          </div>
        </div>
      </div>
    </section>
  );
}
