import { createFileRoute } from "@tanstack/react-router";
import PolaroidBatchMounter from "@/components/tools/PolaroidBatchMounter";
import { publicPageEnabled } from "@/lib/public-pages";
import { useSettings } from "@/lib/store";

export const Route = createFileRoute("/_site/montador-polaroides")({
  head: () => ({ meta: [
    { title: "Montador de Polaroides em lote — Paracolor" },
    { name: "description", content: "Monte Polaroides Baby, Mini e Normal em lote e baixe os arquivos prontos em ZIP." },
  ] }),
  component: PublicPolaroidMounter,
});

function PublicPolaroidMounter() {
  const { settings, isLoading } = useSettings();
  if (isLoading || !publicPageEnabled(settings, "module_polaroid_batch_mounter")) {
    return <section className="container-x py-20 text-center"><p className="eyebrow">Paracolor</p><h1 className="mt-3 text-3xl">Esta ferramenta está temporariamente indisponível</h1></section>;
  }
  return (
    <div>
      <section className="band-gold border-b border-border/70">
        <div className="container-x py-12 sm:py-16">
          <p className="eyebrow">Ferramenta fotográfica</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight sm:text-5xl">Monte suas Polaroides em lote</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">Envie as fotos, escolha o formato e baixe as imagens prontas em um arquivo ZIP.</p>
        </div>
      </section>
      <section className="container-x py-8 sm:py-12">
        <PolaroidBatchMounter publicMode />
      </section>
    </div>
  );
}
