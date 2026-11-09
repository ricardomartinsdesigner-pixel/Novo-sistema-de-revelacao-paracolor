import { Image } from "@/components/ui/image";
import { STUDIO_COVER_FALLBACK } from "@/lib/areas";

/** Abertura cinematográfica: capa em luz quente, véu diagonal, cortina e selo dourado. */
export default function StudioHero({ image, imageAlt, title, text }) {
  return (
    <section className="relative h-[660px] overflow-hidden bg-night sm:h-[780px] lg:h-[860px]">
      <Image
        src={image || STUDIO_COVER_FALLBACK}
        alt={imageAlt}
        className="absolute inset-0 h-full w-full saturate-[.85] brightness-[.7]"
        fittingType="fill"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(115deg,#0B0B0B_8%,rgba(11,11,11,.7)_45%,rgba(11,11,11,.35)_100%),linear-gradient(0deg,#0B0B0B_0,transparent_45%)]"
      />
      <div aria-hidden="true" className="anim-curtain absolute inset-0 z-[3] bg-night" />

      <svg
        viewBox="0 0 150 150"
        aria-hidden="true"
        className="anim-seal-spin absolute right-5 top-6 z-[1] h-24 w-24 sm:right-10 sm:top-10 sm:h-[150px] sm:w-[150px] lg:right-[70px] lg:top-[60px]"
      >
        <defs>
          <path id="studio-seal-path" d="M75 75m-56 0a56 56 0 1 1 112 0a56 56 0 1 1-112 0" />
        </defs>
        <circle cx="75" cy="75" r="72" fill="rgba(11,11,11,.55)" stroke="#C9A24A" />
        <circle cx="75" cy="75" r="40" fill="none" stroke="#6E5A2E" />
        <text fill="#C9A24A" fontFamily="system-ui,sans-serif" fontSize="12" letterSpacing="5">
          <textPath href="#studio-seal-path">ESTÚDIO · ESTÚDIO · ESTÚDIO · </textPath>
        </text>
        <circle cx="75" cy="75" r="14" fill="none" stroke="#C9A24A" strokeWidth="1.5" />
        <circle cx="75" cy="75" r="5" fill="#C9A24A" />
      </svg>

      <div className="relative z-[2] mx-auto flex h-full w-full max-w-[1200px] flex-col justify-between px-5 pb-12 pt-10 sm:px-10 sm:pb-14 sm:pt-12 lg:px-[70px] lg:pb-[60px] lg:pt-[60px]">
        <p className="anim-rise-eb font-body text-[11px] uppercase tracking-[0.26em] text-gold-bright">
          Paracolor · Estúdio
        </p>
        <div>
          <h1 className="anim-rise max-w-[900px] font-display text-[clamp(2.6rem,9vw,7.4rem)] uppercase leading-[0.95] tracking-[-0.01em] text-cream [text-shadow:0_2px_28px_rgba(0,0,0,0.65)]">
            {title}
          </h1>
          <p className="anim-rise-soft mt-7 max-w-[560px] font-body text-[15px] leading-[1.7] text-cream [text-shadow:0_1px_18px_rgba(0,0,0,0.7)]">
            {text}
          </p>
        </div>
      </div>
    </section>
  );
}
