import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import StudioManager from "@/components/admin/StudioManager";

export const Route = createFileRoute("/admin/estudio")({
  head: () => ({ meta: [{ title: "Estúdio Fotográfico — Paracolor" }] }),
  component: StudioAdminPage,
});

function StudioAdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Loja</p>
          <h1 className="mt-1 text-3xl">Estúdio Fotográfico</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Organize as galerias de ensaios que aparecem na página do estúdio. Os textos, a capa e os destaques da
            página ficam em Conteúdo do site.
          </p>
        </div>
        <Link
          to="/estudio-fotografico"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-full border border-gold px-3 py-1.5 text-xs text-gold-deep transition hover:bg-gold-soft"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Ver página pública
        </Link>
      </div>

      <div className="card-glass p-5 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Autorização de imagens:</strong> cada galeria tem um campo interno para
          registrar que a loja possui autorização de uso das fotos de clientes. Galeria sem essa confirmação fica
          guardada aqui e não aparece no site.
        </p>
        <p className="mt-2">
          Textos, capa e destaques: <Link to="/admin/conteudo" className="text-primary underline-offset-4 hover:underline">Conteúdo do site</Link>.
          Endereço, telefone, horário e Instagram do rodapé:{" "}
          <Link to="/admin/configuracoes" className="text-primary underline-offset-4 hover:underline">Configurações</Link>.
        </p>
      </div>

      <StudioManager />
    </div>
  );
}