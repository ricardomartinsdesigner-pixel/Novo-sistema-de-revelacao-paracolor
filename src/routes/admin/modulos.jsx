import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettingsForm } from "@/hooks/use-settings-form";

export const Route = createFileRoute("/admin/modulos")({
  head: () => ({ meta: [{ title: "Módulos — Paracolor" }] }),
  component: ModulesPage,
});

const MODULES = [
  { key: "module_revelacao", label: "Área de revelação" },
  { key: "module_polaroids", label: "Área de polaroids" },
  { key: "module_banners", label: "Área de banners" },
  { key: "module_personalizados", label: "Loja de personalizados" },
  { key: "module_molduras", label: "Vitrine de molduras" },
  { key: "module_molduras_online", label: "Venda online de molduras" },
  { key: "module_aprovacao_whatsapp", label: "Aprovação de arte por WhatsApp" },
  { key: "module_destaques", label: "Destaques na home" },
  { key: "module_promocoes", label: "Promoções" },
  { key: "module_servicos", label: "Página de serviços prestados" },
  { key: "module_estudio", label: "Página do Estúdio Fotográfico" },
  { key: "module_destaque_estudio", label: "Atalho do Estúdio na página inicial" },
  { key: "module_estacionamento", label: "Destaque de estacionamento próprio" },
];

function ModulesPage() {
  const { form, setForm, saving, save, isLoading } = useSettingsForm((settings) =>
    MODULES.reduce((acc, module) => ({ ...acc, [module.key]: settings[module.key] !== false }), {})
  );

  if (isLoading || !form) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Loja</p>
        <h1 className="mt-1 text-3xl">Módulos</h1>
        <p className="mt-1 text-xs text-muted-foreground">Desativar esconde a área do site sem apagar produtos, fotos ou pedidos.</p>
      </div>

      <section className="card-glass p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULES.map((module) => (
            <label key={module.key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              {module.label}
              <Switch checked={form[module.key]} onCheckedChange={(checked) => setForm({ ...form, [module.key]: checked })} />
            </label>
          ))}
        </div>
        <Button onClick={save} disabled={saving} className="mt-5">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar módulos
        </Button>
      </section>
    </div>
  );
}