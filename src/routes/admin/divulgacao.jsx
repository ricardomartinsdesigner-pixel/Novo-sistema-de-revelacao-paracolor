import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import CatalogManager from "@/components/admin/CatalogManager";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettingsForm } from "@/hooks/use-settings-form";

export const Route = createFileRoute("/admin/divulgacao")({
  head: () => ({ meta: [{ title: "Divulgação — Paracolor" }] }),
  component: PromoAdminPage,
});

const FIELDS = [
  { key: "title", label: "Título do banner" },
  { key: "subtitle", label: "Texto de apoio", type: "textarea" },
  { key: "eyebrow", label: "Etiqueta acima do título (opcional)" },
  { key: "image_url", label: "Imagem do banner", type: "image" },
  {
    key: "video_file",
    label: "Vídeo enviado (MP4/WEBM) — tem prioridade sobre a imagem e o YouTube",
    type: "video",
    hint: "Envie o arquivo do vídeo. Ele toca sozinho, sem som, do começo ao fim; o banner só troca quando o vídeo termina.",
  },
  {
    key: "video_url",
    label: "Vídeo do YouTube (link) — alternativa ao arquivo enviado",
    hint: "Cole o link do vídeo (youtube.com/watch?v=… ou youtu.be/…) quando não tiver o arquivo. O player do YouTube mostra título e logo.",
  },
  { key: "caption", label: "Legenda abaixo do banner", type: "textarea" },
  {
    key: "buttons",
    label: "Botões abaixo do banner",
    type: "list",
    subfields: [
      { key: "label", label: "Texto do botão" },
      { key: "link", label: "Link (/revelacao ou https://…)" },
    ],
  },
  { key: "cta_label", label: "Texto do botão sobre o banner (opcional)" },
  { key: "cta_link", label: "Link do botão sobre o banner (ex.: /revelacao ou https://…)" },
  { key: "show_on_home", label: "Exibir na página inicial", type: "switch" },
  { key: "show_on_studio", label: "Exibir no Estúdio Fotográfico", type: "switch" },
  { key: "active", label: "Publicado", type: "switch" },
  { key: "sort", label: "Ordem", type: "number" },
];

const COLUMNS = [
  { key: "title", label: "Banner" },
  {
    key: "video_url",
    label: "Mídia",
    format: (value, record) =>
      record?.video_file ? "Vídeo enviado" : value ? "YouTube" : record?.image_url ? "Foto" : "Sem mídia",
  },
  { key: "active", label: "Status", format: (value) => (value !== false ? "Publicado" : "Rascunho") },
  { key: "sort", label: "Ordem" },
];

const OPTIONS = [
  { key: "promo_home_enabled", label: "Banner rotativo na página inicial" },
  { key: "promo_studio_enabled", label: "Banner rotativo no Estúdio Fotográfico" },
  { key: "promo_whatsapp_enabled", label: "Botão de WhatsApp junto ao banner" },
];

function PromoAdminPage() {
  const { form, setForm, saving, save, isLoading } = useSettingsForm((settings) => ({
    promo_home_enabled: settings.promo_home_enabled !== false,
    promo_studio_enabled: settings.promo_studio_enabled !== false,
    promo_whatsapp_enabled: settings.promo_whatsapp_enabled !== false,
    promo_whatsapp_message: settings.promo_whatsapp_message || "",
    promo_interval_seconds: settings.promo_interval_seconds ?? 6,
  }));

  if (isLoading || !form) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Loja</p>
        <h1 className="mt-1 text-3xl">Divulgação</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Banners que rodam automaticamente na página inicial e no Estúdio Fotográfico para divulgar produtos, serviços
          e ofertas especiais. Cada banner aceita foto, vídeo enviado (MP4/WEBM) ou vídeo do YouTube, com legenda e botões
          extras abaixo. Nos banners com vídeo enviado, o banner espera o vídeo rodar inteiro antes de trocar.
          O botão de WhatsApp usa o número cadastrado em Configurações.
        </p>
      </div>

      <section className="card-glass p-5">
        <h2 className="text-xl">Onde exibir</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((option) => (
            <label key={option.key} className="flex items-center justify-between gap-3 rounded-lg border border-gold/45 px-3 py-2 text-sm">
              {option.label}
              <Switch checked={form[option.key]} onCheckedChange={(checked) => setForm({ ...form, [option.key]: checked })} />
            </label>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted-foreground">
            Mensagem pré-preenchida no WhatsApp
            <input
              value={form.promo_whatsapp_message}
              onChange={(event) => setForm({ ...form, promo_whatsapp_message: event.target.value })}
              placeholder="Olá! Vi uma promoção no site e quero saber mais."
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Tempo de cada banner com foto (segundos)
            <input
              type="number"
              min={3}
              value={form.promo_interval_seconds}
              onChange={(event) => setForm({ ...form, promo_interval_seconds: Number(event.target.value) })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>

        <Button onClick={save} disabled={saving} className="mt-5">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar divulgação
        </Button>
      </section>

      <section className="card-glass p-5">
        <CatalogManager
          entity="PromoBanner"
          title="Banners de divulgação"
          description="Cada banner pode aparecer na home, no estúdio ou nos dois, com foto, vídeo enviado ou vídeo do YouTube, legenda e botões extras. Banners com vídeo enviado só trocam quando o vídeo termina. Despublicar esconde sem apagar."
          fields={FIELDS}
          columns={COLUMNS}
          defaults={{ active: true, show_on_home: true, show_on_studio: true, sort: 0 }}
          sort="sort"
        />
      </section>
    </div>
  );
}