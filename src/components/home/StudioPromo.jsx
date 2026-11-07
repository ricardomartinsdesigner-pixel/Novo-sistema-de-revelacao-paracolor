import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import ParkingHighlight from "@/components/site/ParkingHighlight";
import { moduleEnabled, useSettings } from "@/lib/store";
import { useSiteContent } from "@/hooks/use-site-content";

/** Atalho para o Estúdio Fotográfico e o destaque do estacionamento na home. */
export default function StudioPromo() {
  const { settings } = useSettings();
  const { content } = useSiteContent();
  const studioOn = moduleEnabled(settings, "estudio") && moduleEnabled(settings, "destaque_estudio");
  const parkingOn = moduleEnabled(settings, "estacionamento");
  const image = content["home.studio.image"];
  if (!studioOn && !parkingOn) return null;

  return (
    <section className="container-x py-12">
      {studioOn ? (
        <div className="elev-2 grid overflow-hidden rounded-[1.5rem] border border-border bg-card md:grid-cols-2">
          {image ? (
            <Image
              src={image}
              alt={content["page.estudio.cover_alt"] || "Estúdio fotográfico da Paracolor"}
              className="h-52 w-full object-cover md:h-full"
              fittingType="fill"
              loading="lazy"
            />
          ) : null}
          <div className={`p-7 sm:p-10 ${image ? "" : "md:col-span-2"}`}>
            <p className="eyebrow">{content["home.studio.eyebrow"]}</p>
            <h2 className="mt-2 text-3xl leading-tight">{content["home.studio.title"]}</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{content["home.studio.text"]}</p>
            <Button asChild className="mt-6 gap-2 rounded-full">
              <Link to="/estudio-fotografico">
                {content["home.studio.cta"]} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {parkingOn ? <ParkingHighlight text={content["home.parking.text"]} /> : null}
    </section>
  );
}