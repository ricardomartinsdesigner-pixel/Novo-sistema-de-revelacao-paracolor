import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PromoSlide from "@/components/site/PromoSlide";
import { useEntityList, useSettings } from "@/lib/store";
import { whatsappUrl } from "@/lib/contact";

/** Banner rotativo de divulgação com atalho para o WhatsApp, controlado pelo painel. */
export default function PromoCarousel({ placement = "home", tone = "light" }) {
  const dark = tone === "dark";
  const { settings } = useSettings();
  const { data = [] } = useEntityList("PromoBanner", { active: true }, { sort: "sort" });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const placementKey = placement === "estudio" ? "show_on_studio" : "show_on_home";
  const enabled = settings ? settings[placement === "estudio" ? "promo_studio_enabled" : "promo_home_enabled"] !== false : false;

  const banners = useMemo(() => data.filter((banner) => banner[placementKey] !== false), [data, placementKey]);
  const total = banners.length;
  const seconds = Math.max(3, Number(settings?.promo_interval_seconds) || 6);
  // Banner com vídeo enviado só troca quando o vídeo termina; o tempo fixo vale para fotos.
  const videoSlide = Boolean(banners[index]?.video_file);

  useEffect(() => {
    if (total < 2 || paused) return undefined;
    const wait = videoSlide ? 120 : seconds;
    const timer = setTimeout(() => setIndex((current) => (current + 1) % total), wait * 1000);
    return () => clearTimeout(timer);
  }, [total, seconds, paused, index, videoSlide]);

  useEffect(() => {
    if (index >= total) setIndex(0);
  }, [index, total]);

  if (!enabled || !total) return null;

  const wa =
    settings?.promo_whatsapp_enabled === false
      ? ""
      : whatsappUrl(settings?.whatsapp, settings?.promo_whatsapp_message || settings?.wa_template_contato || "");

  const go = (step) => setIndex((current) => (current + step + total) % total);

  // Legenda e botões extras ficam abaixo do banner e acompanham o slide em exibição.
  const activeBanner = banners[index];
  const caption = String(activeBanner?.caption || "").trim();
  const extraButtons = (Array.isArray(activeBanner?.buttons) ? activeBanner.buttons : []).filter((button) =>
    String(button?.label || "").trim()
  );

  return (
    <section className={dark ? "mx-auto w-full max-w-[1200px] px-5 pt-12 sm:px-10 lg:px-[70px]" : "py-10 sm:py-12"}>
      <div
        className={`relative aspect-video min-h-[15rem] w-full overflow-hidden ${
          dark
            ? "rounded border border-gold-warm-deep bg-night-panel"
            : "elev-3 rounded-[1.5rem] bg-ink"
        }`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-roledescription="carrossel"
        aria-label="Divulgação"
      >
        {banners.map((banner, position) => (
          <PromoSlide
            key={banner.id}
            banner={banner}
            active={position === index}
            onVideoEnded={position === index && total > 1 ? () => go(1) : undefined}
          />
        ))}

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Banner anterior"
              className={`absolute left-2.5 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur transition sm:flex ${
                dark
                  ? "border-gold-warm bg-night/60 text-gold-warm hover:bg-gold-warm hover:text-night"
                  : "border-white/30 bg-black/35 text-white hover:bg-black/55"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próximo banner"
              className={`absolute right-2.5 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur transition sm:flex ${
                dark
                  ? "border-gold-warm bg-night/60 text-gold-warm hover:bg-gold-warm hover:text-night"
                  : "border-white/30 bg-black/35 text-white hover:bg-black/55"
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>

      {caption || extraButtons.length ? (
        <div className="mt-4">
          {caption ? (
            <p className={`max-w-3xl text-sm leading-relaxed ${dark ? "text-cream/75" : "text-muted-foreground"}`}>
              {caption}
            </p>
          ) : null}
          {extraButtons.length ? (
            <div className={`flex flex-wrap gap-2 ${caption ? "mt-3" : ""}`}>
              {extraButtons.map((button, position) => {
                const label = String(button.label || "").trim();
                const href = String(button.link || "").trim();
                if (!href) return null;
                const external = /^https?:\/\//i.test(href);
                const className = dark
                  ? "btn-cine btn-cine-outline px-5 py-2.5 text-xs"
                  : "inline-flex items-center gap-1.5 rounded-full border border-gold/60 bg-card px-4 py-2 text-xs font-medium text-foreground transition hover:border-gold hover:bg-gold-soft";
                const content = (
                  <>
                    {label} <ArrowRight className="h-3.5 w-3.5" />
                  </>
                );
                return external ? (
                  <a key={`${label}-${position}`} href={href} target="_blank" rel="noreferrer" className={className}>
                    {content}
                  </a>
                ) : (
                  <Link key={`${label}-${position}`} to={href} className={className}>
                    {content}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {total > 1 ? (
          <div className="flex items-center gap-1.5">
            {banners.map((banner, position) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Ver banner ${position + 1}`}
                aria-current={position === index}
                className={`h-1.5 rounded-full transition-all ${
                  dark
                    ? position === index
                      ? "w-6 bg-gold-warm"
                      : "w-1.5 bg-gold-warm-deep hover:bg-gold-warm/60"
                    : position === index
                      ? "w-6 bg-gold"
                      : "w-1.5 bg-border hover:bg-gold/60"
                }`}
              />
            ))}
          </div>
        ) : (
          <span />
        )}

        {wa ? (
          dark ? (
            <a href={wa} target="_blank" rel="noreferrer" className="btn-cine btn-cine-outline px-5 py-2.5 text-xs">
              <MessageCircle className="h-3.5 w-3.5" /> Falar no WhatsApp
            </a>
          ) : (
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full">
              <a href={wa} target="_blank" rel="noreferrer">
                <MessageCircle className="h-3.5 w-3.5" /> Falar no WhatsApp
              </a>
            </Button>
          )
        ) : null}
      </div>
    </section>
  );
}