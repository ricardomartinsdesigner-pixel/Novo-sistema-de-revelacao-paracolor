import { createFileRoute } from "@tanstack/react-router";
import PhotoOrderCalculator from "@/components/pricing/PhotoOrderCalculator";

export const Route = createFileRoute("/_site/simulador")({
  head: () => ({
    meta: [
      { title: "Calcular pedido de fotos e Polaroides — Paracolor" },
      { name: "description", content: "Simule o valor de fotos e Polaroides com os preços e as faixas atuais da Paracolor." },
    ],
  }),
  component: OrderCalculatorPage,
});

function OrderCalculatorPage() {
  return (
    <div>
      <section className="band-gold border-b border-border/70">
        <div className="container-x py-12 sm:py-16">
          <p className="eyebrow">Simule antes de pedir</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight sm:text-5xl">Quanto vai ficar o seu pedido?</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Informe quantas fotos e Polaroides deseja. O cálculo usa os preços cadastrados e aplica a faixa de quantidade correspondente.
          </p>
        </div>
      </section>
      <section className="container-x py-8 sm:py-12">
        <PhotoOrderCalculator />
      </section>
    </div>
  );
}
