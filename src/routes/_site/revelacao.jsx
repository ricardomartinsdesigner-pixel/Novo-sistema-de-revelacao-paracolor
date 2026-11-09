import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { useEntityList, useSettings } from "@/lib/store";
import ShippingEstimate from "@/components/site/ShippingEstimate";
import { formatDeadlineDuration } from "@/lib/deadline";
import { formatBRL } from "@/lib/areas";
import { useAreas, useSiteContent } from "@/hooks/use-site-content";
import { publicPageEnabled } from "@/lib/public-pages";

export const Route = createFileRoute("/_site/revelacao")({
  head: () => ({
    meta: [
      { title: "Revelação de fotos — Paracolor" },
      { name: "description", content: "Formatos clássicos e quadrados, com ou sem borda, em papel fotográfico 300 DPI." },
    ],
  }),
  component: RevelacaoPage,
});

function RevelacaoPage() {
  const area = useAreas().find((item) => item.key === "revelacao");
  const { content } = useSiteContent();
  const { settings } = useSettings();
  const { data: sizes = [] } = useEntityList("PhotoSize", { active: true }, { sort: "sort" });

  return (
    <div>
      <section className="band-gold border-b border-border/70">
        <div className="container-x grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="eyebrow">{content["page.revelacao.eyebrow"]}</p>
            <h1 className="mt-3 text-5xl leading-[1.05]">{content["page.revelacao.title"]}</h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
              {content["page.revelacao.text"]}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/revelar">{content["page.revelacao.cta"]} <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <a href="#formatos">Ver tamanhos e preços</a>
              </Button>
              {publicPageEnabled(settings, "page_simulador") && <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/simulador">Calcular meu pedido</Link>
              </Button>}
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Prazo de produção: <strong className="text-foreground">{formatDeadlineDuration(settings, "revelacao")}</strong> após a confirmação do pagamento
            </p>
            <ShippingEstimate />
          </div>
          <Image
            src={area.image}
            alt="Fotos impressas sobre uma mesa clara"
            className="aspect-[4/3] w-full rounded-[1.25rem] object-cover paper"
            fittingType="fill"
          />
        </div>
      </section>

      <section id="formatos" className="container-x py-16">
        <h2 className="text-3xl">{content["page.revelacao.list_title"]}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{content["page.revelacao.list_note"]}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sizes.map((size) => (
            <div key={size.id} className="rounded-[1.25rem] border border-border bg-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-2xl">{size.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {size.width_cm} x {size.height_cm} cm
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl text-primary">{formatBRL(size.price)}</p>
                  {size.is_photo_3x4 && <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">por folha · 12 fotos</p>}
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {size.is_photo_3x4
                  ? "12 fotos de 3,1 × 4,1 cm em uma folha de 15,2 × 13,5 cm. Indicada para escola, currículo e documentos não oficiais."
                  : size.description || "Papel fotográfico brilhante, 300 DPI."}
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Mínimo recomendado: {Math.round((size.width_cm / 2.54) * 300)} x {Math.round((size.height_cm / 2.54) * 300)} px
                {size.border_price ? ` · borda branca + ${formatBRL(size.border_price)}` : ""}
              </p>
            </div>
          ))}
          {!sizes.length && <p className="text-sm text-muted-foreground">Os formatos estão sendo configurados pela loja.</p>}
        </div>

        <div className="mt-12 grid gap-6 rounded-[1.25rem] border border-border bg-card p-8 sm:grid-cols-3">
          {[
            "Escolha entre foto inteira (com borda) ou preenchida",
            "Aviso automático de rosto ou assunto cortado",
            "Detecção de resolução baixa antes de comprar",
          ].map((text) => (
            <p key={text} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 flex-none text-emerald-600" /> {text}
            </p>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/revelar">Começar a revelar</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
