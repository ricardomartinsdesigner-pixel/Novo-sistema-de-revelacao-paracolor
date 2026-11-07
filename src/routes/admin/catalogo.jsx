import { createFileRoute } from "@tanstack/react-router";
import CatalogManager from "@/components/admin/CatalogManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/areas";

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
  { key: "sort", label: "Ordem", type: "number" },
  { key: "active", label: "Ativo", type: "switch" },
];

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
          <TabsTrigger value="polaroids">Polaroids</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="personalizados">Personalizados</TabsTrigger>
          <TabsTrigger value="molduras">Molduras</TabsTrigger>
          <TabsTrigger value="cupons">Cupons</TabsTrigger>
        </TabsList>

        <TabsContent value="revelacao" className="mt-6">
          <CatalogManager
            entity="PhotoSize"
            title="Tamanhos de revelação"
            description="O nome (10x15) é o tamanho comercial; o corte real define a proporção e o arquivo enviado para a impressora. Em branco, vale a medida comercial. Resolução padrão: 300 DPI."
            fields={SIZE_FIELDS}
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
          <CatalogManager
            entity="CustomProduct"
            title="Produtos personalizados"
            description="Campos de foto, textos e adicionais definem o que o cliente preenche na página do produto."
            fields={[
              { key: "name", label: "Nome", type: "text" },
              { key: "code", label: "Código", type: "text" },
              { key: "category", label: "Categoria", type: "text" },
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
              { key: "variations", label: "Variações (JSON)", type: "json" },
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
              { key: "price", label: "Preço", format: (value) => formatBRL(value) },
              { key: "active", label: "Ativo", format: (value) => (value ? "Sim" : "Não") },
            ]}
          />
        </TabsContent>

        <TabsContent value="molduras" className="mt-6">
          <CatalogManager
            entity="Frame"
            title="Molduras"
            description="Modo: exposição (só vitrine), consulta (WhatsApp) ou compra online."
            fields={[
              { key: "name", label: "Nome", type: "text" },
              { key: "code", label: "Código", type: "text" },
              { key: "category", label: "Categoria", type: "text" },
              { key: "material", label: "Material", type: "text" },
              { key: "color", label: "Cor", type: "text" },
              { key: "finish", label: "Acabamento", type: "text" },
              { key: "profile_mm", label: "Perfil (mm)", type: "number" },
              { key: "sizes", label: "Tamanhos compatíveis", type: "text" },
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
          <CatalogManager
            entity="Coupon"
            title="Cupons de desconto"
            description="O desconto é validado no servidor ao concluir o pedido."
            fields={[
              { key: "code", label: "Código", type: "text" },
              {
                key: "type",
                label: "Tipo",
                type: "select",
                options: [
                  { value: "percent", label: "Percentual" },
                  { value: "fixed", label: "Valor fixo" },
                ],
              },
              { key: "value", label: "Valor", type: "number" },
              { key: "min_total", label: "Pedido mínimo", type: "number" },
              { key: "expires_at", label: "Validade (AAAA-MM-DD)", type: "text" },
              { key: "active", label: "Ativo", type: "switch" },
            ]}
            defaults={{ active: true, type: "percent", value: 10, min_total: 0 }}
            columns={[
              { key: "code", label: "Código" },
              { key: "type", label: "Tipo" },
              { key: "value", label: "Valor" },
              { key: "active", label: "Ativo", format: (value) => (value ? "Sim" : "Não") },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}