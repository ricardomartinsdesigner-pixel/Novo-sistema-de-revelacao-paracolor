import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import { moduleEnabled, useSettings } from "@/lib/store";
import { useAreas, useSiteContent } from "@/hooks/use-site-content";

export default function AreasGrid() {
  const { settings } = useSettings();
  const { content } = useSiteContent();
  const allAreas = useAreas();
  const areas = allAreas.filter((area) => moduleEnabled(settings, area.key));
  const MAIN = areas.slice(0, 3);
  const COMPLEMENTARY = areas.slice(3);

  return (
    <section className="band-gold border-t border-border/70 py-20" id="areas">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-lg">
            <p className="eyebrow">{content["home.areas.eyebrow"]}</p>
            <h2 className="mt-3 text-4xl leading-tight">{content["home.areas.title"]}</h2>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{content["home.areas.note"]}</p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {MAIN.map((area) => (
            <Link
              key={area.key}
              to={area.path}
              className="group card-hover elev-1 relative overflow-hidden rounded-[1.25rem] border border-border/80 bg-card"
            >
              <div className="overflow-hidden">
                <Image
                  src={area.image}
                  alt={area.label}
                  className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                  fittingType="fill"
                />
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl">{area.label}</h3>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground transition group-hover:text-primary" strokeWidth={1.5} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{area.tagline}</p>
                <span className="mt-5 inline-block text-sm font-medium text-primary">{area.cta} →</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {COMPLEMENTARY.map((area) => (
            <Link
              key={area.key}
              to={area.path}
              className="group card-hover elev-1 flex items-center gap-5 rounded-[1.25rem] border border-border/80 bg-card p-4"
            >
              <Image
                src={area.image}
                alt={area.label}
                className="h-24 w-24 flex-none rounded-xl object-cover"
                fittingType="fill"
              />
              <div>
                <h3 className="text-xl">{area.label}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{area.tagline}</p>
                <span className="mt-2 inline-block text-sm font-medium text-primary">{area.cta} →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}