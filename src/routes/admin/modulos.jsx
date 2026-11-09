import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettingsForm } from "@/hooks/use-settings-form";
import { FEATURE_MODULES, PAGE_GROUPS } from "@/lib/public-pages";

export const Route = createFileRoute("/admin/modulos")({
  head: () => ({ meta: [{ title: "Módulos — Paracolor" }] }),
  component: ModulesPage,
});

const PAGE_SETTINGS = PAGE_GROUPS.flatMap((group) => group.pages);
const ALL_SETTINGS = [
  ...PAGE_SETTINGS.map((page) => ({ key: page.setting, label: page.label })),
  ...FEATURE_MODULES,
];

function ModulesPage() {
  const { form, setForm, saving, save, isLoading } = useSettingsForm((settings) =>
    ALL_SETTINGS.reduce((acc, setting) => ({ ...acc, [setting.key]: settings[setting.key] !== false }), {})
  );

  if (isLoading || !form) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Loja</p>
        <h1 className="mt-1 text-3xl">Páginas e módulos</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Ative ou desative cada página pública. Uma página desativada sai dos links do site e mostra um aviso se alguém abrir o endereço diretamente. Desativar carrinho, checkout ou conta impede o cliente de usar esse fluxo enquanto o interruptor estiver desligado.</p>
      </div>

      {PAGE_GROUPS.map((group) => (
        <section key={group.label} className="card-glass p-5">
          <h2 className="text-lg">{group.label}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {group.pages.map((page) => (
              <label key={page.setting} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                {page.label}
                <Switch checked={form[page.setting]} onCheckedChange={(checked) => setForm({ ...form, [page.setting]: checked })} />
              </label>
            ))}
          </div>
        </section>
      ))}

      <section className="card-glass p-5">
        <h2 className="text-lg">Recursos e destaques</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FEATURE_MODULES.map((module) => (
            <label key={module.key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              {module.label}
              <Switch checked={form[module.key]} onCheckedChange={(checked) => setForm({ ...form, [module.key]: checked })} />
            </label>
          ))}
        </div>
      </section>
      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar páginas e módulos
      </Button>
    </div>
  );
}
