import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import AdminImageField from "@/components/admin/AdminImageField";
import AdminVideoField from "@/components/admin/AdminVideoField";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useEntityPage } from "@/lib/use-entity-page";

function emptyValue(field) {
  if (field.type === "number") return 0;
  if (field.type === "switch") return true;
  if (field.type === "select") return field.options?.[0]?.value ?? "";
  if (field.type === "list") return [];
  if (field.type === "json") return [];
  if (field.type === "gallery") return [];
  return "";
}

function ListEditor({ value, subfields, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  function updateRow(index, key, next) {
    onChange(rows.map((row, position) => (position === index ? { ...row, [key]: next } : row)));
  }
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="rounded-lg border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {subfields.map((sub) => (
              <label key={sub.key} className="text-[11px] text-muted-foreground">
                {sub.label}
                {sub.type === "switch" ? (
                  <div className="mt-1">
                    <Switch checked={Boolean(row[sub.key])} onCheckedChange={(checked) => updateRow(index, sub.key, checked)} />
                  </div>
                ) : sub.type === "image" ? (
                  <div className="mt-1">
                    <AdminImageField value={row[sub.key] ?? ""} onChange={(next) => updateRow(index, sub.key, next)} />
                  </div>
                ) : (
                  <input
                    type={sub.type === "number" ? "number" : "text"}
                    value={row[sub.key] ?? (sub.type === "number" ? 0 : "")}
                    onChange={(event) => updateRow(index, sub.key, sub.type === "number" ? Number(event.target.value) : event.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                  />
                )}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, position) => position !== index))}
            className="mt-2 text-[11px] text-red-600 hover:underline"
          >
            Remover
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, {}])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
      </Button>
    </div>
  );
}

// Galeria de fotos extras: cada linha é uma foto enviada do computador.
function GalleryField({ value, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  const replaceRow = (index, next) => onChange(rows.map((item, position) => (position === index ? next : item)));
  return (
    <div className="space-y-2">
      {rows.map((url, index) => (
        <div key={index} className="rounded-lg border border-border p-2">
          <AdminImageField value={url} onChange={(next) => replaceRow(index, next)} />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, position) => position !== index))}
            className="mt-1.5 text-[11px] text-red-600 hover:underline"
          >
            Remover foto
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, ""])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar foto
      </Button>
    </div>
  );
}

function FieldInput({ field, value, onChange }) {
  if (field.type === "switch") {
    return <Switch checked={Boolean(value)} onCheckedChange={onChange} />;
  }
  if (field.type === "select") {
    return (
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
      >
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }
  if (field.type === "textarea") {
    return (
      <textarea
        rows={3}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
      />
    );
  }
  if (field.type === "list") {
    return <ListEditor value={value} subfields={field.subfields} onChange={onChange} />;
  }
  if (field.type === "json") {
    return (
      <textarea
        rows={5}
        value={typeof value === "string" ? value : JSON.stringify(value ?? [], null, 2)}
        onChange={(event) => {
          try {
            onChange(JSON.parse(event.target.value));
          } catch {
            onChange(event.target.value);
          }
        }}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-[11px] text-foreground"
      />
    );
  }
  if (field.type === "image") {
    return <AdminImageField value={value} onChange={onChange} hint={field.hint} />;
  }
  if (field.type === "video") {
    return <AdminVideoField value={value} onChange={onChange} hint={field.hint} />;
  }
  if (field.type === "gallery") {
    return <GalleryField value={value} onChange={onChange} />;
  }
  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      step={field.step || "any"}
      value={value ?? ""}
      onChange={(event) => onChange(field.type === "number" ? Number(event.target.value) : event.target.value)}
      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
    />
  );
}

export default function CatalogManager({ entity, title, description, fields, columns, defaults = {}, sort = "created_date" }) {
  const queryClient = useQueryClient();
  const { records: data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useEntityPage(entity, {}, { sort });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  function startNew() {
    const initial = {};
    fields.forEach((field) => {
      initial[field.key] = defaults[field.key] ?? emptyValue(field);
    });
    setForm(initial);
    setOpen(true);
  }

  function startEdit(record) {
    const initial = { id: record.id };
    fields.forEach((field) => {
      initial[field.key] = record[field.key] ?? emptyValue(field);
    });
    setForm(initial);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = { ...form };
      const id = payload.id;
      delete payload.id;
      if (id) await base44.entities[entity].update(id, payload);
      else await base44.entities[entity].create(payload);
      await queryClient.invalidateQueries({ queryKey: [entity] });
      toast.success("Registro salvo");
      setOpen(false);
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function duplicate(record) {
    const payload = { ...record };
    delete payload.id;
    delete payload.created_date;
    delete payload.updated_date;
    delete payload.created_by_id;
    await base44.entities[entity].create(payload);
    await queryClient.invalidateQueries({ queryKey: [entity] });
    toast.success("Registro duplicado");
  }

  async function remove(record) {
    if (!confirm("Excluir este registro?")) return;
    await base44.entities[entity].delete(record.id);
    await queryClient.invalidateQueries({ queryKey: [entity] });
    toast.success("Registro excluído");
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">{title}</h2>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <Button size="sm" onClick={startNew} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 font-medium">{column.label}</th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.map((record) => (
              <tr key={record.id} className="border-t border-border">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-2">
                    {column.format ? column.format(record[column.key], record) : String(record[column.key] ?? "—")}
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button type="button" onClick={() => startEdit(record)} className="rounded p-1.5 text-muted-foreground hover:text-foreground" aria-label="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => duplicate(record)} className="rounded p-1.5 text-muted-foreground hover:text-foreground" aria-label="Duplicar">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => remove(record)} className="rounded p-1.5 text-muted-foreground hover:text-red-600" aria-label="Excluir">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!data.length && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {isPending ? "Carregando catálogo…" : error ? "Não foi possível carregar o catálogo." : "Nenhum registro ainda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">Tentar novamente</Button>}
      {hasNextPage && <Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={() => fetchNextPage()} className="mt-3">{isFetchingNextPage ? "Carregando…" : "Carregar mais"}</Button>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogTitle className="font-display text-xl">{form?.id ? "Editar" : "Novo"} · {title}</DialogTitle>
          {form && (
            <div className="mt-4 space-y-4">
              {fields.map((field) => (
                <div key={field.key} className="block">
                  <span className="text-xs text-muted-foreground">{field.label}</span>
                  <div className="mt-1">
                    <FieldInput
                      field={field}
                      value={form[field.key]}
                      onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save} disabled={saving}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}