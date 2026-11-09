import { Sparkles } from "lucide-react";
import { Image } from "@/components/ui/image";

const QUOTE_IMAGE =
  "/loja/estudio-destaque.webp";

/** Os três diferenciais do estúdio em faixa dourada e a citação dos 6 estúdios. */
export default function StudioHighlights({ content, image }) {
  const benefits = [1, 2, 3].map((position) => ({
    title: content[`page.estudio.benefit${position}.title`],
    text: content[`page.estudio.benefit${position}.text`],
  }));

  return (
    <>
      <div className="mx-auto mt-14 w-full max-w-[1200px] px-5 sm:px-10 lg:px-[70px]">
        <div className="grid border-y border-gold-warm sm:grid-cols-3">
          {benefits.map((benefit, position) => (
            <div
              key={position}
              style={{ animationDelay: `${1.8 + position * 0.2}s` }}
              className={`anim-rise-col py-11 sm:px-[34px] ${
                position > 0 ? "border-t border-gold-warm sm:border-l sm:border-t-0" : ""
              }`}
            >
              <span className="block font-display text-[88px] leading-none text-transparent [-webkit-text-stroke:1px_#C9A24A] sm:text-[120px]">
                0{position + 1}
              </span>
              <h3 className="mt-3 font-display text-[22px] uppercase leading-[1.15] text-cream sm:text-[26px]">
                {benefit.title}
              </h3>
              <p className="mt-3 font-body text-sm leading-[1.7] text-cream/90">{benefit.text}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="relative mt-14 flex h-[440px] flex-col items-center justify-center overflow-hidden px-5 text-center sm:mt-[60px] sm:h-[520px] sm:px-16 lg:px-[200px]">
        <Image
          src={image || QUOTE_IMAGE}
          alt="Detalhe de equipamento fotográfico do estúdio"
          className="absolute inset-0 h-full w-full brightness-[.4] saturate-[.8]"
          fittingType="fill"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(0deg,#0B0B0B,transparent_30%,transparent_70%,#0B0B0B)]"
        />
        <p className="relative inline-flex items-center gap-2 font-body text-[11px] uppercase tracking-[0.26em] text-gold-bright">
          <Sparkles className="h-3 w-3" aria-hidden="true" /> Estrutura
        </p>
        <p className="relative mt-5 font-display text-[clamp(2rem,4.2vw,3.1rem)] uppercase leading-[1.05] text-cream">
          {content["page.estudio.studios.title"]}
        </p>
        <p className="relative mt-5 max-w-[520px] font-body text-[15px] leading-[1.7] text-cream">
          {content["page.estudio.studios.text"]}
        </p>
      </section>
    </>
  );
}