import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import CatalogManager from "@/components/admin/CatalogManager";

export const Route = createFileRoute("/admin/servicos")({
  head: () => ({ meta: [{ title: "Serviços — Paracolor" }] }),
  component: ServicesAdminPage,
});

function ServicesAdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Loja</p>
          <h1 className="mt-1 text-3xl">Catálogo de serviços</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Cada serviço vira um cartão na página de serviços, com foto, título, descrição e um botão que leva a pessoa
            para o atendimento já escolhido aqui.
          </p>
        </div>
        <Link
          to="/servicos"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-full border border-gold px-3 py-1.5 text-xs text-gold-deep transition hover:bg-gold-soft"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Ver página pública
        </Link>
      </div>

      <div className="card-glass p-5 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Rascunho e publicação:</strong> desligue “Serviço ativo” para guardar o
          serviço sem mostrá-lo no site. Só aparece no catálogo o serviço ativo e com a autorização de uso das fotos
          confirmada.
        </p>
        <p className="mt-2">
          <strong className="text-foreground">Preço:</strong> o valor só é exibido quando você preenche o preço e marca
          a confirmação. Sem isso, o cartão mostra apenas o botão de contato.
        </p>
      </div>

      <section className="card-glass p-5">
        <CatalogManager
          entity="Service"
          title="Serviços"
          description="A ordem aqui define a ordem dos cartões na página /servicos."
          sort="sort"
          defaults={{
            active: true,
            sort: 0,
            image_authorized: false,
            price_confirmed: false,
            contact_action: "orcamento",
            button_label: "Solicitar orçamento",
            photos: [],
          }}
          fields={[
            { key: "title", label: "Título", type: "text" },
            { key: "category", label: "Categoria (opcional)", type: "text" },
            { key: "short_description", label: "Descrição curta do cartão", type: "textarea" },
            { key: "description", label: "Descrição detalhada", type: "textarea" },
            { key: "image_url", label: "Foto principal", type: "image" },
            { key: "image_alt", label: "Texto alternativo da foto principal", type: "text" },
            {
              key: "photos",
              label: "Fotos extras",
              type: "list",
              subfields: [
                { key: "url", label: "Foto", type: "image" },
                { key: "alt", label: "Texto alternativo", type: "text" },
              ],
            },
            { key: "button_label", label: "Texto do botão", type: "text" },
            {
              key: "contact_action",
              label: "O botão abre",
              type: "select",
              options: [
                { value: "orcamento", label: "Página de contato (orçamento)" },
                { value: "whatsapp", label: "Conversa no WhatsApp" },
                { value: "email", label: "E-mail da loja" },
              ],
            },
            { key: "price", label: "Preço (deixe 0 para não exibir)", type: "number" },
            { key: "price_confirmed", label: "Confirmo que este preço pode aparecer no site", type: "switch" },
            { key: "image_authorized", label: "Tenho autorização de uso das fotos deste serviço", type: "switch" },
            { key: "sort", label: "Ordem", type: "number" },
            { key: "active", label: "Serviço ativo", type: "switch" },
          ]}
          columns={[
            { key: "title", label: "Serviço" },
            { key: "category", label: "Categoria" },
            { key: "active", label: "Ativo", format: (value) => (value ? "Sim" : "Rascunho") },
            { key: "image_authorized", label: "Fotos autorizadas", format: (value) => (value ? "Sim" : "Não") },
            { key: "sort", label: "Ordem" },
          ]}
        />
      </section>
    </div>
  );
}