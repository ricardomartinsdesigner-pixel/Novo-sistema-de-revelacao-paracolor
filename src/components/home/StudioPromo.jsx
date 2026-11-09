import { Link } from "@tanstack/react-router";
import { ArrowRight, Camera } from "lucide-react";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import ParkingHighlight from "@/components/site/ParkingHighlight";
import { moduleEnabled, useSettings } from "@/lib/store";
import { useSiteContent } from "@/hooks/use-site-content";

export default function StudioPromo() {
  const { settings } = useSettings();
  const { content } = useSiteContent();
  const studioOn = moduleEnabled(settings, "estudio") && moduleEnabled(settings, "destaque_estudio");
  const parkingOn = moduleEnabled(settings, "estacionamento");
  const image = content["home.studio.image"] || content["page.estudio.cover"];
  if (!studioOn && !parkingOn) return null;

  return (
    <div className="container-x py-10 sm:py-14">
      {studioOn && (
        <section aria-labelledby="home-studio-title" className="ink-panel elev-2 grid overflow-hidden rounded-[1.5rem] border border-gold/50 md:grid-cols-2">
          <div className="relative min-h-56 overflow-hidden border-b border-gold/30 sm:min-h-72 md:order-2 md:min-h-full md:border-b-0 md:border-l">
            <Image
              src={image}
              alt={content["page.estudio.cover_alt"] || "Estúdio fotográfico da Paracolor"}
              className="absolute inset-0 h-full w-full object-cover"
              fittingType="fill"
              loading="lazy"
            />
          </div>
          <div className="flex flex-col items-start justify-center px-6 py-8 sm:p-10 lg:p-14">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.17em] text-gold-bright">
              <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
              {content["home.studio.eyebrow"]}
            </p>
            <h2 id="home-studio-title" className="mt-3 text-4xl leading-tight lg:text-5xl">
              {content["home.studio.title"]}
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-foreground/85">{content["home.studio.text"]}</p>
            <Button asChild size="lg" className="mt-6 h-auto min-h-11 max-w-full gap-2 whitespace-normal rounded-full bg-gold-bright py-2.5 text-ink hover:bg-gold">
              <Link to="/estudio-fotografico">
                {content["home.studio.cta"]} <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      )}

      {parkingOn && <ParkingHighlight text={content["home.parking.text"]} />}
    </div>
  );
}
