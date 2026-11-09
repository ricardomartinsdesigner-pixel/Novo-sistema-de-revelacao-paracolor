import CampaignManager from "@/components/admin/CampaignManager";
import { createFileRoute } from "@tanstack/react-router";
import CatalogManager from "@/components/admin/CatalogManager";
import CatalogTaxonomyManager from "@/components/admin/CatalogTaxonomyManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/areas";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useEntityList } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Loader2, WandSparkles } from "lucide-react";

export const Route = createFileRoute("/admin/catalogo")({
  head: () => ({ meta: [{ title: "Catálogo — Paracolor" }] }),
  component: CatalogoPage,
});

const SIZE_FIELDS = [
  { key: "name", label: "Nome", type: "text" },
  { key: "width_cm", label: "Largura (cm)", type: "number" },
  { key: "height_cm", label: "Altura (cm)", type: "number" },
  { key: "price", label: "Preço", type: "number" },
  { key: "border_price", label: "Acréscimo da borda", type: "number" },
  { key: "print_width_cm", label: "Corte real — largura (cm)", type: "number" },
  { key: "print_height_cm", label: "Corte real — altura (cm)", type: "number" },
  { key: "dpi", label: "Resolução de saída (DPI)", type: "number" },
  { key: "description", label: "Descrição", type: "textarea" },
  { key: "is_photo_3x4", label: "Montagem especial Foto 3×4", type: "switch" },
  { key: "sort", label: "Ordem", type: "number" },
  { key: "active", label: "Ativo", type: "switch" },
];

function Photo34PricePanel() {
  const { data: sizes = [], isLoading } = useEntityList("PhotoSize", {}, { sort: "sort", limit: 1000 });
  const queryClient = useQueryClient();
  const record = sizes.find((size) => size.is_photo_3x4);
  const [price, setPrice] = useState("");
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrice(record ? String(record.price ?? 0) : "");
    setActive(Boolean(record?.active));
  }, [record?.id, record?.price, record?.active]);

  async function createFormat() {
    setSaving(true);
    try {
      await base44.entities.PhotoSize.create({
        name: "Foto 3×4 · 12 unidades",
        width_cm: 3.1,
        height_cm: 4.1,
        print_width_cm: 3.1,
        print_height_cm: 4.1,
        dpi: 300,
        price: 0,
        border_price: 0,
        description: "Uma folha 15,2 × 13,5 cm com 12 fotos 3,1 × 4,1 cm e folga de 3,2 mm.",
        is_photo_3x4: true,
        active: false,
        sort: sizes.reduce((max, size) => Math.max(max, Number(size.sort) || 0), 0) + 1,
      });
      await queryClient.invalidateQueries({ queryKey: ["PhotoSize"] });
      toast.success("Formato criado. Informe o preço por folha para ativá-lo.");
    } catch (error) {
      toast.error(error?.message || "Não foi possível criar o formato 3×4.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFormat() {
    if (!record) return;
    const amount = Number(String(price).replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0 || (active && amount <= 0)) {
      toast.error("Informe um preço válido por folha antes de ativar a Foto 3×4.");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.PhotoSize.update(record.id, { price: amount, active });
      await queryClient.invalidateQueries({ queryKey: ["PhotoSize"] });
      toast.success("Preço da Foto 3×4 salvo.");
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar o preço.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-5 border border-gold/50 bg-gold-soft/20 p-4 sm:p-5" aria-labelledby="photo34-settings-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Preço configurável</p>
          <h3 id="photo34-settings-title" className="mt-1 text-lg">Revelação de fotos 3×4</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            O valor é por folha 15,2 × 13,5 cm. Cada folha leva 12 fotos de 3,1 × 4,1 cm, centralizadas com 3,2 mm entre elas.
          </p>
        </div>
        {isLoading ? <p className="text-xs text-muted-foreground">Carregando configuração…</p> : null}
      </div>
      {!record && !isLoading ? (
        <Button type="button" className="mt-4" onClick={createFormat} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Criar formato 3×4
        </Button>
      ) : record ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[170px] text-xs font-medium">Preço por folha (R$)
            <input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            Disponível na loja
          </label>
          <Button type="button" onClick={saveFormat} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar configuração
          </Button>
          <span className="pb-2 text-xs text-muted-foreground">{active ? "Ativa para clientes" : "Desativada para clientes"}</span>
        </div>
      ) : null}
    </section>
  );
}

function CatalogoPage() {
  return (
    <div>
      <p className="eyebrow">Loja</p>
      <h1 className="mt-1 text-3xl">Catálogo</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tudo que aparece nas áreas de venda. Desativar um item não apaga pedidos nem fotos.
      </p>

      <Tabs defaultValue="revelacao" className="mt-6">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-secondary/60 p-1">
          <TabsTrigger value="revelacao">Revelação</TabsTrigger>
          <TabsTrigger value="polaroids">Polaroides</TabsTrigger>
          <TabsTrigger value="imas">Ímãs de foto</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="personalizados">Personalizados</TabsTrigger>
          <TabsTrigger value="albuns_books">Álbuns e Books</TabsTrigger>
          <TabsTrigger value="molduras">Molduras</TabsTrigger>
          <TabsTrigger value="cupons">Cupons</TabsTrigger>
        </TabsList>

        <TabsContent value="revelacao" className="mt-6">
          <Photo34PricePanel />
          <CatalogManager
            entity="PhotoSize"
            title="Tamanhos de revelação"
            description="O nome (10x15) e o preço continuam sendo comerciais. Para definir um corte diferente, preencha largura e altura do corte real juntas; se uma delas ficar vazia, o sistema usa as duas medidas comerciais. A orientação detectada da foto ajusta a miniatura, a mesa e o arquivo de impressão. Resolução padrão: 300 DPI."
            fields={SIZE_FIELDS}
            hideDuplicate={(record) => Boolean(record.is_photo_3x4)}
            sort="sort"
            defaults={{ active: true, sort: 0, border_price: 0 }}
            columns={[
              { key: "name", label: "Nome" },
              { key: "width_cm", label: "Largura" },
              { key: "height_cm", label: "Altura" },
              { key: "price", label: "Preço", format: (value) => formatBRL(value) },
              { key: "active", label: "Ativo", format: (value) => (value ? "Sim" : "Não") },
            ]}
          />
        </TabsContent>

        <TabsContent value="albuns_books" className="mt-6">
          <CatalogTaxonomyManager scope="albuns_books" title="Categorias de Álbuns e Books" />
          <CatalogManager
            entity="CustomProduct"
            title="Cadastro de álbuns e books"
            description="Organize os produtos por categoria, capacidade e formato. Se o item aceitar personalização, marque essa opção e configure as fotos e textos que o cliente poderá enviar."
            categoryScope="albuns_books"
            query={{ catalog_type: { $in: ["album", "book"] } }}
            fields={[
              { key: "catalog_type", label: "Tipo de produto", type: "select", options: [{ value: "album", label: "Álbum" }, { value: "book", label: "Book" }] },
              { key: "name", label: "Nome do produto", type: "text" },
              { key: "code", label: "Código", type: "text" },
              { key: "category", label: "Categoria", type: "category" },
              { key: "subcategory", label: "Subcategoria", type: "subcategory" },
              { key: "short_description", label: "Resumo para a vitrine", type: "text" },
              { key: "full_description", label: "Descrição completa", type: "textarea" },
              { key: "image", label: "Capa ou imagem principal", type: "image" },
              { key: "images", label: "Fotos internas e galeria", type: "gallery" },
              { key: "album_size", label: "Tamanho do álbum/book", type: "text" },
              { key: "album_style", label: "Estilo", type: "text" },
              { key: "photo_capacity", label: "Quantidade de fotos", type: "number" },
              { key: "page_count", label: "Número de páginas", type: "number" },
              { key: "cover_material", label: "Material da capa", type: "text" },
              { key: "binding", label: "Tipo de encadernação", type: "text" },
              { key: "print_dimensions", label: "Tamanho da foto/página", type: "text" },
              { key: "customizable", label: "Permite personalização do cliente", type: "switch" },
              { key: "price", label: "Preço", type: "number" },
              { key: "promo_price", label: "Preço promocional", type: "number" },
              { key: "production_days", label: "Prazo (dias úteis)", type: "number" },
              { key: "stock", label: "Estoque", type: "number" },
              { key: "sort", label: "Ordem", type: "number" },
              { key: "featured", label: "Destaque", type: "switch" },
              { key: "active", label: "Ativo na loja", type: "switch" },
              { key: "photo_fields", label: "Fotos enviadas pelo cliente", type: "list", subfields: [
                { key: "label", label: "Campo (ex.: Foto da capa)", type: "text" },
                { key: "required", label: "Obrigatório", type: "switch" },
                { key: "instructions", label: "Orientação para o cliente", type: "text" },
              ] },
              { key: "text_fields", label: "Textos na capa/álbum", type: "list", subfields: [
                { key: "label", label: "Campo (ex.: Nome ou frase)", type: "text" },
                { key: "required", label: "Obrigatório", type: "switch" },
                { key: "max_length", label: "Limite de caracteres", type: "number" },
              ] },
              { key: "variations", label: "Variações e opções", type: "variations" },
              { key: "addons", label: "Adicionais pagos", type: "list", subfields: [
                { key: "label", label: "Nome", type: "text" }, { key: "price", label: "Preço adicional", type: "number" },
              ] },
              { key: "art_approval_mode", label: "Aprovação da arte", type: "select", options: [
                { value: "desativada", label: "Desativada" }, { value: "opcional", label: "Opcional" }, { value: "obrigatoria", label: "Obrigatória" },
              ] },
            ]}
            sections={[
              { title: "Identificação e categoria", fields: ["catalog_type", "name", "code", "category", "subcategory", "short_description", "full_description"] },
              { title: "Formato e capacidade", fields: ["album_size", "album_style", "photo_capacity", "page_count", "print_dimensions", "cover_material", "binding"] },
              { title: "Imagens do produto", description: "Mostre a capa e páginas internas na vitrine.", fields: ["image", "images"] },
              { title: "Personalização pelo cliente", description: "Quando ativada, os campos abaixo permitem receber fotos e textos para a capa ou para o álbum.", fields: ["customizable", "photo_fields", "text_fields", "variations", "addons", "art_approval_mode"] },
              { title: "Preço e publicação", fields: ["price", "promo_price", "production_days", "stock", "sort", "featured", "active"] },
            ]}
            defaults={{ catalog_type: "album", customizable: false, active: true, featured: false, price: 0, promo_price: 0, production_days: 0, stock: 0, sort: 0, images: [], photo_fields: [{ label: "Foto para a capa", required: true, instructions: "Envie a foto que deseja usar na capa." }], text_fields: [{ label: "Nome ou frase para a capa", required: false, max_length: 60 }], variations: [], addons: [], art_approval_mode: "opcional" }}
            sort="sort"
            columns={[
              { key: "catalog_type", label: "Tipo", format: (value) => value === "book" ? "Book" : "Álbum" },
              { key: "name", label: "Produto" }, { key: "category", label: "Categoria" },
              { key: "album_size", label: "Tamanho" }, { key: "photo_capacity", label: "Fotos" },
              { key: "customizable", label: "Personalizado", format: (value) => value ? "Sim" : "Não" },
              { key: "price", label: "Preço", format: (value) => Number(value) ? formatBRL(value) : "Sob consulta" },
              { key: "active", label: "Ativo", format: (value) => value ? "Sim" : "Não" },
            ]}
          />
        </TabsContent>

        <TabsContent value="polaroids" className="mt-6">
          <CatalogManager
            entity="PolaroidModel"
            title="Modelos de polaroid"
            description="Moldura, tamanho e área de escrita. caption_area é a fração da altura reservada para a legenda (0,16 = 16%)."
            fields={[
              { key: "name", label: "Nome", type: "text" },
              { key: "width_cm", label: "Largura (cm)", type: "number" },
              { key: "height_cm", label: "Altura (cm)", type: "number" },
              { key: "price", label: "Preço", type: "number" },
              { key: "caption_area", label: "Área da legenda (0-0.4)", type: "number", step: "0.01" },
              { key: "has_caption", label: "Tem legenda", type: "switch" },
              { key: "frame_color", label: "Cor da moldura", type: "text" },
              { key: "description", label: "Descrição", type: "textarea" },
              { key: "sort", label: "Ordem", type: "number" },
              { key: "active", label: "Ativo", type: "switch" },
            ]}
            sort="sort"
            defaults={{ active: true, has_caption: true, caption_area: 0.16, frame_color: "#ffffff", sort: 0 }}
            columns={[
              { key: "name", label: "Modelo" },
              { key: "width_cm", label: "Largura" },
              { key: "height_cm", label: "Altura" },
              { key: "price", label: "Preço", format: (value) => formatBRL(value) },
              { key: "active", label: "Ativo", format: (value) => (value ? "Sim" : "Não") },
            ]}
          />
        </TabsContent>

        <TabsContent value="imas" className="mt-6 space-y-6">
          <MagnetCatalogStarter />
          <CatalogManager
            entity="MagnetProduct"
            title="Formatos de fotos ímã"
            description="Cadastre os formatos vendidos e o preço fixo do kit de três tirinhas. Para os outros formatos, configure as faixas em Preços e descontos → Ímãs de foto."
            fields={[
              { key: "kind", label: "Tipo", type: "select", options: [
                { value: "photo", label: "Foto magnética" }, { value: "polaroid", label: "Ímã estilo Polaroide" }, { value: "strip_kit", label: "Kit com 3 tirinhas" },
              ] },
              { key: "name", label: "Nome do formato", type: "text" },
              { key: "width_cm", label: "Largura (cm)", type: "number" },
              { key: "height_cm", label: "Altura (cm)", type: "number" },
              { key: "price", label: "Preço base / preço do kit", type: "number" },
              { key: "caption_area", label: "Área da legenda (0-0.4)", type: "number", step: "0.01" },
              { key: "frame_color", label: "Cor da moldura", type: "text" },
              { key: "description", label: "Descrição", type: "textarea" },
              { key: "sort", label: "Ordem", type: "number" },
              { key: "active", label: "Ativo", type: "switch" },
            ]}
            sort="sort"
            defaults={{ kind: "photo", active: true, price: 0, caption_area: 0.16, frame_color: "#ffffff", sort: 0 }}
            columns={[
              { key: "name", label: "Formato" },
              { key: "kind", label: "Tipo", format: (value) => ({ photo: "Foto", polaroid: "Polaroide", strip_kit: "Kit de 3 tirinhas" }[value] || value) },
              { key: "width_cm", label: "Largura" },
              { key: "height_cm", label: "Altura" },
              { key: "price", label: "Preço base/kit", format: (value) => Number(value) ? formatBRL(value) : "Configure preço" },
              { key: "active", label: "Ativo", format: (value) => value ? "Sim" : "Não" },
            ]}
          />
        </TabsContent>

        <TabsContent value="banners" className="mt-6 space-y-8">
          <CatalogManager
            entity="BannerSize"
            title="Tamanhos de banner"
            description="O preço é base + área (m²) × valor por m² + acabamentos."
            fields={[
              { key: "name", label: "Nome", type: "text" },
              { key: "width_cm", label: "Largura (cm)", type: "number" },
              { key: "height_cm", label: "Altura (cm)", type: "number" },
              { key: "base_price", label: "Preço base", type: "number" },
              { key: "price_per_m2", label: "Preço por m²", type: "number" },
              { key: "description", label: "Descrição", type: "textarea" },
              { key: "sort", label: "Ordem", type: "number" },
              { key: "active", label: "Ativo", type: "switch" },
            ]}
            sort="sort"
            defaults={{ active: true, sort: 0, base_price: 0, price_per_m2: 45 }}
            columns={[
              { key: "name", label: "Nome" },
              { key: "width_cm", label: "Largura" },
              { key: "height_cm", label: "Altura" },
              { key: "base_price", label: "Base", format: (value) => formatBRL(value) },
              { key: "price_per_m2", label: "por m²", format: (value) => formatBRL(value) },
            ]}
          />
          <CatalogManager
            entity="BannerOption"
            title="Materiais e acabamentos"
            description="Material cobra por m²; acabamento cobra valor fixo."
            fields={[
              { key: "name", label: "Nome", type: "text" },
              {
                key: "kind",
                label: "Tipo",
                type: "select",
                options: [
                  { value: "material", label: "Material" },
                  { value: "acabamento", label: "Acabamento" },
                ],
              },
              { key: "price_per_m2", label: "Preço por m²", type: "number" },
              { key: "price_fixed", label: "Preço fixo", type: "number" },
              { key: "sort", label: "Ordem", type: "number" },
              { key: "active", label: "Ativo", type: "switch" },
            ]}
            sort="sort"
            defaults={{ active: true, kind: "material", sort: 0, price_per_m2: 0, price_fixed: 0 }}
            columns={[
              { key: "name", label: "Nome" },
              { key: "kind", label: "Tipo" },
              { key: "price_per_m2", label: "por m²", format: (value) => formatBRL(value || 0) },
              { key: "price_fixed", label: "Fixo", format: (value) => formatBRL(value || 0) },
            ]}
          />
        </TabsContent>

        <TabsContent value="personalizados" className="mt-6">
          <CatalogTaxonomyManager scope="personalizados" title="Personalizados" />
          <CatalogManager
            entity="CustomProduct"
            title="Produtos personalizados"
            description="Cadastre o produto por etapas. Categorias organizam a vitrine; campos de personalização e variações definem o que o cliente poderá escolher."
            categoryScope="personalizados"
            query={{ catalog_type: { $nin: ["album", "book"] } }}
            fields={[
              { key: "name", label: "Nome", type: "text" },
              { key: "code", label: "Código", type: "text" },
              { key: "category", label: "Categoria", type: "category" },
              { key: "subcategory", label: "Subcategoria", type: "subcategory" },
              { key: "short_description", label: "Descrição curta", type: "text" },
              { key: "full_description", label: "Descrição completa", type: "textarea" },
              { key: "image", label: "Imagem principal", type: "image" },
              { key: "images", label: "Fotos extras da galeria", type: "gallery" },
              { key: "price", label: "Preço", type: "number" },
              { key: "promo_price", label: "Preço promocional", type: "number" },
              { key: "production_days", label: "Prazo (dias úteis)", type: "number" },
              { key: "stock", label: "Estoque", type: "number" },
              { key: "sort", label: "Ordem", type: "number" },
              { key: "featured", label: "Destaque", type: "switch" },
              { key: "active", label: "Ativo", type: "switch" },
              {
                key: "art_approval_mode",
                label: "Aprovação de arte",
                type: "select",
                options: [
                  { value: "desativada", label: "Desativada" },
                  { value: "opcional", label: "Opcional" },
                  { value: "obrigatoria", label: "Obrigatória" },
                ],
              },
              {
                key: "photo_fields",
                label: "Campos de foto",
                type: "list",
                subfields: [
                  { key: "label", label: "Nome do campo", type: "text" },
                  { key: "required", label: "Obrigatório", type: "switch" },
                  { key: "instructions", label: "Instruções", type: "text" },
                ],
              },
              {
                key: "text_fields",
                label: "Campos de texto",
                type: "list",
                subfields: [
                  { key: "label", label: "Nome do campo", type: "text" },
                  { key: "required", label: "Obrigatório", type: "switch" },
                  { key: "max_length", label: "Limite de caracteres", type: "number" },
                ],
              },
              {
                key: "addons",
                label: "Adicionais pagos",
                type: "list",
                subfields: [
                  { key: "label", label: "Nome", type: "text" },
                  { key: "price", label: "Preço", type: "number" },
                ],
              },
              { key: "variations", label: "Variações e opções", type: "variations" },
            ]}
            sections={[
              { title: "Identificação", fields: ["name", "code", "category", "subcategory", "short_description", "full_description"] },
              { title: "Preço e operação", fields: ["price", "promo_price", "production_days", "stock", "sort"] },
              { title: "Fotos do produto", description: "A imagem principal aparece na vitrine; as fotos extras formam a galeria.", fields: ["image", "images"] },
              { title: "Personalização do cliente", description: "Defina os campos de foto, texto, adicionais e escolhas com preço.", fields: ["photo_fields", "text_fields", "addons", "variations"] },
              { title: "Venda e aprovação", fields: ["art_approval_mode", "featured", "active"] },
            ]}
            sort="sort"
            defaults={{
              active: true,
              featured: false,
              sort: 0,
              art_approval_mode: "opcional",
              images: [],
              photo_fields: [{ label: "Foto principal", required: true }],
              text_fields: [],
              addons: [],
              variations: [],
            }}
            columns={[
              { key: "name", label: "Produto" },
              { key: "category", label: "Categoria" },
              { key: "subcategory", label: "Subcategoria" },
              { key: "price", label: "Preço", format: (value) => formatBRL(value) },
              { key: "active", label: "Ativo", format: (value) => (value ? "Sim" : "Não") },
            ]}
          />
        </TabsContent>

        <TabsContent value="molduras" className="mt-6">
          <CatalogTaxonomyManager scope="molduras" title="Molduras" />
          <CatalogManager
            entity="Frame"
            title="Molduras"
            description="Organize cada modelo por categoria e subcategoria e preencha os detalhes do acabamento e da venda."
            categoryScope="molduras"
            fields={[
              { key: "name", label: "Nome", type: "text" },
              { key: "code", label: "Código", type: "text" },
              { key: "category", label: "Categoria", type: "category" },
              { key: "subcategory", label: "Subcategoria", type: "subcategory" },
              { key: "material", label: "Material", type: "text" },
              { key: "color", label: "Cor", type: "text" },
              { key: "finish", label: "Acabamento", type: "text" },
              { key: "profile_mm", label: "Perfil (mm)", type: "number" },
              { key: "sizes", label: "Tamanhos compatíveis (separados por vírgula)", type: "text" },
              { key: "description", label: "Descrição", type: "textarea" },
              { key: "price", label: "Preço", type: "number" },
              { key: "availability", label: "Disponibilidade", type: "text" },
              {
                key: "mode",
                label: "Modo",
                type: "select",
                options: [
                  { value: "exposicao", label: "Somente exposição" },
                  { value: "consulta", label: "Consulta pelo WhatsApp" },
                  { value: "compra", label: "Compra online" },
                ],
              },
              { key: "image", label: "Imagem", type: "image" },
              { key: "active", label: "Ativo", type: "switch" },
              { key: "featured", label: "Destaque", type: "switch" },
              { key: "sort", label: "Ordem", type: "number" },
            ]}
            sections={[
              { title: "Identificação", fields: ["name", "code", "category", "subcategory"] },
              { title: "Material e medidas", fields: ["material", "color", "finish", "profile_mm", "sizes", "availability"] },
              { title: "Descrição e imagem", fields: ["description", "image"] },
              { title: "Preço e venda", description: "Escolha se a moldura aparece na vitrine, recebe consulta por WhatsApp ou pode ser comprada no site.", fields: ["price", "mode", "featured", "active", "sort"] },
            ]}
            sort="sort"
            defaults={{ active: true, mode: "consulta", sort: 0 }}
            columns={[
              { key: "name", label: "Moldura" },
              { key: "color", label: "Cor" },
              { key: "material", label: "Material" },
              { key: "mode", label: "Modo" },
              { key: "active", label: "Ativo", format: (value) => (value ? "Sim" : "Não") },
            ]}
          />
        </TabsContent>

        <TabsContent value="cupons" className="mt-6">
          <CampaignManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MagnetCatalogStarter() {
  const { data: products = [], isLoading } = useEntityList("MagnetProduct", {}, { sort: "sort" });
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  if (isLoading || products.length) return null;

  async function createDefaults() {
    setCreating(true);
    const defaults = [
      { name: "Kit 3 tirinhas 5x20", kind: "strip_kit", width_cm: 15.2, height_cm: 20, price: 0, active: true, sort: 1, description: "Folha com três tirinhas magnéticas 5x20 cm." },
      { name: "Ímã 5x7", kind: "photo", width_cm: 5, height_cm: 7, price: 0, active: true, sort: 2 },
      { name: "Ímã 7x10", kind: "photo", width_cm: 7, height_cm: 10, price: 0, active: true, sort: 3 },
      { name: "Ímã 10x15", kind: "photo", width_cm: 10, height_cm: 15, price: 0, active: true, sort: 4 },
      { name: "Ímã Polaroide Baby 5x7", kind: "polaroid", width_cm: 5, height_cm: 7, price: 0, active: true, sort: 5, caption_area: 0.22 },
      { name: "Ímã Polaroide Mini 7x9", kind: "polaroid", width_cm: 7, height_cm: 9, price: 0, active: true, sort: 6, caption_area: 0.22 },
      { name: "Ímã Polaroide Normal 9x11", kind: "polaroid", width_cm: 9, height_cm: 11, price: 0, active: true, sort: 7, caption_area: 0.22 },
    ];
    try {
      await base44.entities.MagnetProduct.bulkCreate(defaults);
      const existingTiers = await base44.entities.QuantityTier.filter({ category: "magnet" }, { limit: 20 });
      if (!(existingTiers?.items || []).length) await base44.entities.QuantityTier.bulkCreate([
        { category: "magnet", label: "1 a 15", min_qty: 1, max_qty: 15, active: true, sort: 1 },
        { category: "magnet", label: "16 a 99", min_qty: 16, max_qty: 99, active: true, sort: 2 },
        { category: "magnet", label: "100 a 499", min_qty: 100, max_qty: 499, active: true, sort: 3 },
        { category: "magnet", label: "500 a 1000", min_qty: 500, max_qty: 1000, active: true, sort: 4 },
      ]);
      const createdProducts = await base44.entities.MagnetProduct.filter({}, { sort: "sort", limit: 100 });
      const currentGroups = await base44.entities.PriceGroup.filter({ category: "magnet" }, { limit: 20 });
      if (!(currentGroups?.items || []).length) {
        await base44.entities.PriceGroup.create({ category: "magnet", name: "Todos os ímãs — contagem conjunta", size_ids: (createdProducts?.items || []).filter((item) => item.kind !== "strip_kit").map((item) => item.id), active: true, sort: 1 });
      }
      await Promise.all(["MagnetProduct", "QuantityTier", "TierPrice", "PriceGroup"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      toast.success("Formatos e faixas iniciais criados. Informe os preços antes de publicar a página.");
    } catch (error) {
      toast.error(error?.message || "Não foi possível criar os formatos.");
    } finally {
      setCreating(false);
    }
  }

  return <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gold/40 bg-gold-soft/25 p-4">
    <p className="text-sm">Crie os formatos iniciais de tirinha, ímã fotográfico e Polaroide magnética.</p>
    <Button type="button" onClick={createDefaults} disabled={creating} className="rounded-full">
      {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
      Criar formatos iniciais
    </Button>
  </div>;
}
