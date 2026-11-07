import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { youtubeEmbedUrl } from "@/lib/youtube";

/** Um banner de divulgação: vídeo enviado, vídeo do YouTube ou foto de fundo, com texto e chamada sobrepostos. */
export default function PromoSlide({ banner, active, onVideoEnded }) {
  const file = banner.video_file;
  const image = banner.image_url;
  const embed = youtubeEmbedUrl(banner.video_url);
  const hasMedia = Boolean(file || embed || image);
  const title = banner.title || "Divulgação Paracolor";
  const label = String(banner.cta_label || "").trim();
  const href = String(banner.cta_link || "").trim();
  const external = /^https?:\/\//i.test(href);

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-700 ${active ? "visible opacity-100" : "invisible opacity-0"}`}
      aria-hidden={!active}
    >
      {file ? (
        active ? (
          <video
            src={file}
            aria-label={title}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
            preload="metadata"
            loop={!onVideoEnded}
            onEnded={onVideoEnded}
          />
        ) : (
          <div className="bg-ink h-full w-full" />
        )
      ) : embed ? (
        active ? (
          <iframe
            src={embed}
            title={title}
            className="h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            tabIndex={-1}
          />
        ) : (
          <div className="bg-ink h-full w-full" />
        )
      ) : image ? (
        <Image src={image} alt={title} className="h-full w-full object-cover" fittingType="fill" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-secondary via-background to-gold-soft" />
      )}
      {hasMedia ? (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
      ) : null}

      <div className="relative flex h-full flex-col justify-end p-5 sm:p-8">
        {banner.eyebrow ? (
          <p className={`text-[10px] uppercase tracking-[0.24em] ${hasMedia ? "text-gold-bright" : "text-gold-deep"}`}>{banner.eyebrow}</p>
        ) : null}
        <h3 className={`mt-2 max-w-lg font-display text-2xl leading-tight sm:text-3xl ${hasMedia ? "text-white" : "text-foreground"}`}>{banner.title}</h3>
        {banner.subtitle ? (
          <p className={`mt-2 max-w-md text-sm leading-relaxed ${hasMedia ? "text-white/80" : "text-muted-foreground"}`}>{banner.subtitle}</p>
        ) : null}
        {label && href ? (
          <Button
            asChild
            size="sm"
            className="mt-4 w-fit gap-1.5 rounded-full border-2 border-background bg-background px-5 font-semibold text-foreground shadow-[0_14px_32px_-12px_rgba(0,0,0,0.9)] hover:border-gold-bright hover:bg-gold-bright hover:text-ink"
          >
            {external ? (
              <a href={href} target="_blank" rel="noreferrer">
                {label} <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : (
              <Link to={href}>
                {label} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}