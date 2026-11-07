import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEntityList } from "@/lib/store";
import { formatBRL } from "@/lib/areas";
import PolaroidModelPreview from "@/components/polaroids/PolaroidModelPreview";

// Sugestão de complemento no carrinho: quem já escolheu fotos ganha o convite
// para levar polaroids do mesmo pedido, sem refazer o envio.
export default function CartUpsell({ hasPolaroid }) {
  const { data: models = [] } = useEntityList("PolaroidModel", { active: true }, { sort: "sort" });
  if (hasPolaroid || !models.length) return null;

  return (
    <section className="mt-12 rounded-[1.25rem] border border-border bg-secondary/30 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Complete seu pedido</p>
          <h2 className="mt-1 text-2xl">Leve também polaroids</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            As mesmas fotos em moldura branca com legenda — envie uma vez e ajuste na prévia.
          </p>
        </div>
        <Link
          to="/polaroids/criar"
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          Criar polaroids <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {models.slice(0, 3).map((model) => (
          <Link
            key={model.id}
            to="/polaroids/criar"
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"
          >
            <div className="w-14 shrink-0">
              <PolaroidModelPreview model={model} maxWidth={56} caption="" />
            </div>
            <div>
              <p className="text-sm font-medium">{model.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {model.width_cm} × {model.height_cm} cm
              </p>
              <p className="mt-2 text-sm">{formatBRL(model.price)} <span className="text-[11px] text-muted-foreground">por unidade</span></p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}