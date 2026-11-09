import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, Instagram, Loader2, MapPin, MessageCircle, Phone } from "lucide-react";
import ModuleUnavailable from "@/components/site/ModuleUnavailable";
import StudioGallerySection from "@/components/studio/StudioGallerySection";
import StudioHero from "@/components/studio/StudioHero";
import StudioHighlights from "@/components/studio/StudioHighlights";
import PromoCarousel from "@/components/site/PromoCarousel";
import ParkingHighlight from "@/components/site/ParkingHighlight";
import { moduleEnabled, useEntityList, useSettings } from "@/lib/store";
import { useSiteContent } from "@/hooks/use-site-content";
import { instagramHandle, instagramUrl, serviceMessage, telHref, whatsappUrl } from "@/lib/contact";

const BACKSTAGE_IMAGE =
  "/loja/estudio-bastidores.webp";

export const Route = createFileRoute("/_site/estudio-fotografico")({
  head: () => ({
    meta: [
      { title: "Estúdio Fotográfico — Paracolor" },
      {
        name: "description",
        content:
          "O estúdio fotográfico da Paracolor: ensaios sem agendamento, fotos ilimitadas, seis estúdios equipados e você paga apenas as fotos que escolher.",
      },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  const { settings, isLoading: settingsLoading } = useSettings();
  const { content } = useSiteContent();
  const galleriesQuery = useEntityList("StudioGallery", { active: true, authorized: true }, { sort: "sort" });
  const photosQuery = useEntityList("StudioPhoto", { active: true }, { sort: "sort" });

  if (!settingsLoading && !moduleEnabled(settings, "estudio")) {
    return <ModuleUnavailable title="O Estúdio Fotográfico está fora do ar" />;
  }

  const galleries = galleriesQuery.data || [];
  const photos = photosQuery.data || [];
  const cover = content["page.estudio.cover"];
  const wa = whatsappUrl(settings?.whatsapp, serviceMessage(settings?.wa_template_contato, "Estúdio Fotográfico"));
  const phone = telHref(settings?.phone);
  const instagram = instagramUrl(settings?.instagram);
  const hours = String(settings?.hours || "").trim();

  const infoItems = [
    settings?.address ? { icon: MapPin, label: "Endereço", value: settings.address } : null,
    hours ? { icon: Clock, label: "Horário de atendimento", value: hours } : null,
    instagram
      ? {
          icon: Instagram,
          label: "Instagram",
          value: instagramHandle(settings.instagram),
          href: instagram,
        }
      : null,
  ].filter(Boolean);

  return (
    <div className="bg-night pb-16 text-cream">
      <StudioHero
        image={cover}
        imageAlt={content["page.estudio.cover_alt"] || "Estúdio fotográfico da Paracolor"}
        title={content["page.estudio.title"]}
        text={content["page.estudio.text"]}
      />

      <PromoCarousel placement="estudio" tone="dark" />

      <StudioHighlights content={content} image={content["page.estudio.highlight_image"]} />

      <section className="mx-auto mt-16 w-full max-w-[1200px] px-5 sm:px-10 lg:px-[70px]">
        <p className="font-body text-[11px] uppercase tracking-[0.26em] text-gold-bright">
          {content["page.estudio.gallery_text"]}
        </p>
        <h2 className="mt-3 font-display text-[clamp(2rem,4vw,2.9rem)] uppercase leading-[1.05] text-cream">
          {content["page.estudio.gallery_title"]}
        </h2>

        {galleriesQuery.isLoading ? (
          <p className="mt-5 flex items-center gap-2 font-body text-[13px] leading-[1.6] text-cream/80">
            <Loader2 className="h-4 w-4 animate-spin text-gold-bright" /> Carregando galerias…
          </p>
        ) : galleriesQuery.isError ? (
          <div className="mt-4 rounded border border-gold-warm/45 bg-night-panel p-5 font-body text-[13px] text-cream/80">
            <p>Não foi possível carregar as galerias agora.</p>
            <button
              type="button"
              onClick={() => galleriesQuery.refetch()}
              className="btn-cine btn-cine-outline mt-3 px-4 py-2 text-xs"
            >
              Tentar novamente
            </button>
          </div>
        ) : galleries.length ? (
          galleries.map((gallery) => (
            <StudioGallerySection
              key={gallery.id}
              gallery={gallery}
              photos={photos.filter((photo) => photo.gallery_id === gallery.id)}
            />
          ))
        ) : (
          <p className="mt-4 border border-dashed border-gold-warm/45 p-7 text-center font-body text-[13px] text-cream/85">
            As galerias de ensaios serão publicadas aqui pela equipe da loja.
          </p>
        )}

        <div className="relative mt-9 w-full overflow-hidden border border-gold-warm/45 bg-night-panel">
          <img
            src={content["page.estudio.backstage"] || BACKSTAGE_IMAGE}
            alt="Bastidores do estúdio"
            loading="lazy"
            className="block h-auto w-full grayscale brightness-75"
          />
        </div>
      </section>

      <section className="mx-auto mt-16 w-full max-w-[1200px] px-5 sm:px-10 lg:px-[70px]">
        <div className="relative rounded border border-gold-warm/45 bg-night-panel p-7 sm:p-10 lg:p-[54px]">
          <span
            aria-hidden="true"
            className="absolute inset-x-[10%] top-0 h-px bg-[linear-gradient(90deg,transparent,#C9A24A,transparent)]"
          />
          <h2 className="font-display text-[clamp(2rem,4vw,2.9rem)] uppercase leading-[1.05] text-cream">
            {content["page.estudio.visit_title"]}
          </h2>
          <p className="mt-4 max-w-[560px] font-body text-[15px] leading-[1.7] text-cream">
            {content["page.estudio.visit_text"]}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {wa ? (
              <a href={wa} target="_blank" rel="noreferrer" className="btn-cine btn-cine-gold">
                <MessageCircle className="h-4 w-4" /> {content["page.estudio.cta"]}
              </a>
            ) : (
              <Link to="/contato" className="btn-cine btn-cine-gold">
                <MessageCircle className="h-4 w-4" /> {content["page.estudio.cta"]}
              </Link>
            )}
            {phone ? (
              <a href={phone} className="btn-cine btn-cine-outline">
                <Phone className="h-4 w-4" /> {settings.phone}
              </a>
            ) : null}
          </div>

          <dl className="mt-9 grid gap-6 border-t border-gold-warm/45 pt-7 sm:grid-cols-3 sm:gap-0">
            {infoItems.map((item, position) => (
              <div
                key={item.label}
                className={`flex gap-3 ${position > 0 ? "sm:border-l sm:border-gold-warm/45 sm:pl-6" : ""} ${
                  position < infoItems.length - 1 ? "sm:pr-6" : ""
                }`}
              >
                <item.icon
                  className="mt-[2px] h-[18px] w-[18px] shrink-0 text-gold-bright"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                <div>
                  <dt className="font-body text-[11px] uppercase tracking-[0.2em] text-gold-bright">
                    {item.label}
                  </dt>
                  <dd className="mt-1.5 font-body text-sm leading-[1.6] text-cream">
                    {item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-4 hover:text-gold-bright hover:underline"
                      >
                        {item.value}
                      </a>
                    ) : (
                      item.value
                    )}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {moduleEnabled(settings, "estacionamento") ? (
        <ParkingHighlight text={content["page.estudio.parking"]} variant="studio" />
      ) : null}
    </div>
  );
}