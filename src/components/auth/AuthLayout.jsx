import { Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Sparkles, Truck } from "lucide-react";

const POINTS = [
  { icon: Sparkles, title: "Do arquivo à impressão", text: "Veja o corte e a qualidade da foto antes de comprar." },
  { icon: Truck, title: "Produção acompanhada", text: "Saiba em que etapa o seu pedido está, até a retirada." },
  { icon: MessageCircle, title: "Atendimento humano", text: "Fale direto com a equipe da loja pelo WhatsApp." },
];

// Full-screen card shared by the auth pages; it sets its own color tokens so it stays readable under any theme.
export function AuthLayout({ icon: Icon, title, subtitle, footer, children, embedded = false }) {
  if (embedded) {
    return (
      <div>
        <h2 className="text-lg">{title}</h2>
        {subtitle && <p className="mb-4 mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
        {children}
      </div>
    );
  }
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="ink-panel relative hidden w-[46%] flex-col justify-between overflow-hidden px-10 py-12 lg:flex xl:px-14">
        <div className="relative">
          <Link to="/" className="font-display text-2xl leading-none tracking-tight text-cream">
            Paracolor
          </Link>
          <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-gold-bright">
            Revelação · Polaroids · Personalizados
          </p>
        </div>

        <div className="relative max-w-sm">
          <h2 className="font-display text-3xl leading-tight text-cream">
            Suas memórias impressas com o cuidado de um ateliê.
          </h2>
          <div className="gold-rule mt-6" />
          <ul className="mt-6 space-y-5">
            {POINTS.map((point) => (
              <li key={point.title} className="flex items-start gap-3">
                <point.icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-bright" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-cream">{point.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-cream/60">{point.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-cream/40">Impressão fotográfica e personalizados</p>
      </aside>

      <main className="flex w-full flex-col lg:w-[54%]">
        <div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-card px-3.5 py-2 text-xs font-medium text-foreground transition hover:border-gold hover:bg-gold-soft"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Voltar à página inicial
          </Link>
          <span className="font-display text-lg leading-none text-gold-deep lg:hidden">Paracolor</span>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-7">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="text-3xl leading-tight sm:text-4xl">{title}</h1>
              {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
            </div>

            <div className="card-glass p-6 text-card-foreground sm:p-8">{children}</div>
            {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}