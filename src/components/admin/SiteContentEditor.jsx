import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CONTENT_GROUPS, IMAGE_KEYS } from "@/lib/site-content";
import SiteImageField from "@/components/admin/SiteImageField";

async function loadRecords() {
  const result = await base44.entities.SiteContent.list({ limit: 500 });
  return Array.isArray(result) ? result : result?.items ?? [];
}

export default function SiteContentEditor() {
  const queryClient = useQueryClient();
  const { data: records = [], isLoading } = useQuery({ queryKey: ["site-content-admin"], queryFn: loadRecords });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (form || isLoading) return;
    const initial = {};
    for (const group of CONTENT_GROUPS) {
      for (const field of group.fields) initial[field.key] = "";
    }
    for (const record of records) {
      if (record?.key) initial[record.key] = record.value || "";
    }
    setForm(initial);
  }, [form, isLoading, records]);

  function change(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const byKey = new Map(records.map((record) => [record.key, record]));
      const updates = [];
      const creates = [];
      for (const [key, value] of Object.entries(form)) {
        const next = (value ?? "").trim();
        const record = byKey.get(key);
        if (record) {
          if ((record.value || "") !== next) updates.push({ id: record.id, value: next });
        } else if (next) {
          creates.push({ key, value: next, type: IMAGE_KEYS.has(key) ? "image" : "text" });
        }
      }
      if (creates.length) await base44.entities.SiteContent.bulkCreate(creates);
      if (updates.length) await base44.entities.SiteContent.bulkUpdate(updates);
      await queryClient.invalidateQueries({ queryKey: ["site-content"] });
      await queryClient.invalidateQueries({ queryKey: ["site-content-admin"] });
      toast.success("Conteúdo do site atualizado");
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar o conteúdo.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !form) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando conteúdo…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {CONTENT_GROUPS.map((group) => (
        <section key={group.id} className="card-glass p-5">
          <h2 className="text-lg">{group.label}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {group.fields.map((field) => {
              if (field.type === "image") {
                return (
                  <div key={field.key} className="sm:col-span-2">
                    <SiteImageField
                      label={field.label}
                      hint={field.hint}
                      value={form[field.key]}
                      fallback={field.default}
                      onChange={(value) => change(field.key, value)}
                    />
                  </div>
                );
              }
              return (
                <div key={field.key} className={field.type === "textarea" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                  <Label htmlFor={field.key} className="text-xs">{field.label}</Label>
                  {field.type === "textarea" ? (
                    <textarea
                      id={field.key}
                      value={form[field.key]}
                      onChange={(event) => change(field.key, event.target.value)}
                      rows={3}
                      placeholder={field.default}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  ) : (
                    <input
                      id={field.key}
                      value={form[field.key]}
                      onChange={(event) => change(field.key, event.target.value)}
                      placeholder={field.default}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  )}
                  {field.hint ? <p className="text-[11px] text-muted-foreground">{field.hint}</p> : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 flex items-center justify-between gap-4 card-glass/95 p-4 backdrop-blur">
        <p className="text-xs text-muted-foreground">
          Campos em branco usam o texto padrão do site.
        </p>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar conteúdo
        </Button>
      </div>
    </div>
  );
}