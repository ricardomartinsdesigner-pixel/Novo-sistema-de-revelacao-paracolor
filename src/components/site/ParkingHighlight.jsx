import { CircleParking } from "lucide-react";

/**
 * Destaque de estacionamento próprio.
 * `home` — faixa compacta e chamativa na página inicial.
 * `studio` — bloco de grande impacto visual na página do estúdio.
 */
export default function ParkingHighlight({ text, variant = "home" }) {
  if (!text) return null;
  if (variant === "studio") return <StudioParking text={text} />;
  return <HomeParking text={text} />;
}

function HomeParking({ text }) {
  return (
    <div className="ink-panel elev-2 relative mt-4 flex items-center gap-4 overflow-hidden rounded-[1.25rem] px-5 py-5 sm:gap-5 sm:px-7 sm:py-6">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -top-12 h-32 w-32 rounded-full bg-gold/25 blur-2xl"
      />
      <span
        aria-hidden="true"
        className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-gold-bright/45 bg-gold/15 shadow-[0_18px_36px_-22px_rgba(0,0,0,0.9)]"
      >
        <CircleParking className="h-8 w-8 text-gold-bright" strokeWidth={1.7} aria-hidden="true" />
      </span>
      <div className="relative min-w-0">
        <p className="text-[10px] uppercase tracking-[0.26em] text-gold-bright/90">Estacionamento próprio</p>
        <p className="mt-1 font-display text-lg leading-snug text-ink-foreground sm:text-2xl">{text}</p>
      </div>
    </div>
  );
}

function StudioParking({ text }) {
  return (
    <section className="mx-auto mt-16 w-full max-w-[1200px] px-5 sm:px-10 lg:px-[70px]">
      <div className="anim-shine relative overflow-hidden rounded border border-gold-warm bg-[radial-gradient(60%_80%_at_50%_0%,rgba(201,162,74,.28),transparent_70%),#0B0B0B] px-6 py-14 text-center sm:py-20">
        <div className="relative z-[1] flex flex-col items-center">
          <span className="grid h-[120px] w-[120px] place-items-center rounded-full border border-gold-warm bg-gold-warm/10 shadow-[inset_0_0_0_8px_#0B0B0B,inset_0_0_0_9px_rgba(201,162,74,.4),0_20px_50px_-20px_rgba(0,0,0,.9)]">
            <CircleParking className="h-14 w-14 text-gold-warm" strokeWidth={1.5} aria-hidden="true" />
          </span>

          <p className="mt-7 font-body text-[11px] uppercase tracking-[0.32em] text-gold-warm">
            Estacionamento próprio
          </p>
          <p className="mt-4 max-w-[760px] font-display text-[clamp(1.9rem,4vw,2.9rem)] uppercase leading-[1.05] text-cream">
            {text}
          </p>
          <span
            aria-hidden="true"
            className="anim-line mt-7 block h-px w-24 bg-[linear-gradient(90deg,transparent,#C9A24A,transparent)]"
          />
        </div>
      </div>
    </section>
  );
}