import { createFileRoute } from "@tanstack/react-router";
import CatalogManager from "@/components/admin/CatalogManager";
import SiteContentEditor from "@/components/admin/SiteContentEditor";

export const Route = createFileRoute("/admin/conteudo")({
  head: () => ({ meta: [{ title: "Conteúdo — Paracolor" }] }),
  component: ContentPage,
});

function ContentPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Loja</p>
        <h1 className="mt-1 text-3xl">Conteúdo do site</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Edite os textos e troque as fotos das páginas, além da logomarca e do favicon. As alterações aparecem no site
          assim que você salvar.
        </p>
      </div>

      <SiteContentEditor />

      <section className="card-glass p-5">
        <CatalogManager
          entity="GalleryItem"
          title="Galeria de clientes"
          description="Fotos reais de pedidos entregues. Aparecem na página inicial na ordem definida aqui."
          sort="sort"
          defaults={{ active: true, sort: 0 }}
          fields={[
            { key: "image_url", label: "Foto", type: "image", pixelSpec: "1200 × 1200 px (proporção 1:1), recomendado para a galeria da página inicial." },
            { key: "caption", label: "Legenda (opcional)", type: "textarea" },
            { key: "customer_name", label: "Cliente (opcional)", type: "text" },
            { key: "sort", label: "Ordem", type: "number" },
            { key: "active", label: "Aparece no site", type: "switch" },
          ]}
          columns={[
            { key: "image_url", label: "Foto", format: (value) => (value ? "Enviada" : "—") },
            { key: "caption", label: "Legenda" },
            { key: "customer_name", label: "Cliente" },
            { key: "sort", label: "Ordem" },
            { key: "active", label: "Ativa", format: (value) => (value ? "Sim" : "Não") },
          ]}
        />
      </section>

      <section className="card-glass p-5">
        <CatalogManager
          entity="Testimonial"
          title="Depoimentos"
          description="Aparecem na home quando ativos."
          fields={[
            { key: "name", label: "Nome", type: "text" },
            { key: "city", label: "Cidade", type: "text" },
            { key: "text", label: "Depoimento", type: "textarea" },
            { key: "rating", label: "Nota (1-5)", type: "number" },
            { key: "sort", label: "Ordem", type: "number" },
            { key: "active", label: "Ativo", type: "switch" },
          ]}
          defaults={{ active: true, rating: 5, sort: 0 }}
          sort="sort"
          columns={[
            { key: "name", label: "Nome" },
            { key: "city", label: "Cidade" },
            { key: "active", label: "Ativo", format: (value) => (value ? "Sim" : "Não") },
          ]}
        />
      </section>
    </div>
  );
}
