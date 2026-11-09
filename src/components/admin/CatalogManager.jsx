import { useMemo, useState } from "react";
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
import { useEntityList } from "@/lib/store";

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

function VariationsEditor({ value, onChange }) {
  const variations = Array.isArray(value) ? value : [];
  function updateVariation(index, patch) {
    onChange(variations.map((variation, position) => position === index ? { ...variation, ...patch } : variation));
  }
  function updateOption(variationIndex, optionIndex, patch) {
    onChange(variations.map((variation, position) => {
      if (position !== variationIndex) return variation;
      return { ...variation, options: (variation.options || []).map((option, index) => {
        const normalized = typeof option === "string" ? { label: option, price_delta: 0 } : option;
        return index === optionIndex ? { ...normalized, ...patch } : normalized;
      }) };
    }));
  }
  return (
    <div className="space-y-3">
      {variations.map((variation, index) => (
        <section key={index} className="rounded-lg border border-border p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex-1 text-[11px] text-muted-foreground">Nome da opção
              <input value={variation.name || ""} onChange={(event) => updateVariation(index, { name: event.target.value })} placeholder="Ex.: Tamanho" className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground" />
            </label>
            <Button type="button" variant="ghost" size="sm" className="self-end text-destructive" onClick={() => onChange(variations.filter((_, position) => position !== index))}>Remover grupo</Button>
          </div>
          <div className="mt-3 space-y-2">
            {(variation.options || []).map((option, optionIndex) => (
              <div key={optionIndex} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                <label className="text-[11px] text-muted-foreground">Opção
                  <input value={typeof option === "string" ? option : option.label || ""} onChange={(event) => updateOption(index, optionIndex, { label: event.target.value })} placeholder="Ex.: Grande" className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground" />
                </label>
                <label className="text-[11px] text-muted-foreground">Acréscimo (R$)
                  <input type="number" step="0.01" value={typeof option === "string" ? 0 : option.price_delta ?? 0} onChange={(event) => updateOption(index, optionIndex, { price_delta: Number(event.target.value) })} className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground" />
                </label>
                <button type="button" onClick={() => updateVariation(index, { options: variation.options.filter((_, position) => position !== optionIndex) })} aria-label="Remover opção" className="mb-2 rounded p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <Button type="button" size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => updateVariation(index, { options: [...(variation.options || []), { label: "", price_delta: 0 }] })}>
            <Plus className="h-3.5 w-3.5" /> Adicionar opção
          </Button>
        </section>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...variations, { name: "", options: [] }])}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar grupo de opções
      </Button>
      <p className="text-[11px] text-muted-foreground">O cliente escolhe uma opção de cada grupo. O acréscimo é somado ao preço base do produto.</p>
    </div>
  );
}

function FieldInput({ field, value, onChange, options, disabled }) {
  if (field.type === "switch") {
    return <Switch checked={Boolean(value)} onCheckedChange={onChange} />;
  }
  if (field.type === "select" || field.type === "category" || field.type === "subcategory") {
    return (
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
      >
        {(options || field.options || []).map((option) => (
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
  if (field.type === "variations") return <VariationsEditor value={value} onChange={onChange} />;
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
    return <AdminImageField value={value} onChange={onChange} hint={field.hint} pixelSpec={field.pixelSpec} />;
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

export default function CatalogManager({ entity, title, description, fields, columns, defaults = {}, sort = "created_date", categoryScope, sections, query = {}, hideDuplicate = () => false }) {
  const queryClient = useQueryClient();
  const { records: data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useEntityPage(entity, query, { sort });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const { data: taxonomyRows = [] } = useEntityList("CatalogCategory", { scope: categoryScope || "__none__" }, { sort: "sort", limit: 500 });
  const taxonomy = useMemo(() => taxonomyRows.filter((row) => row.active !== false), [taxonomyRows]);
  const topCategories = useMemo(() => taxonomy.filter((row) => !row.parent_id), [taxonomy]);
  const allCategoryRows = useMemo(() => taxonomyRows.filter((row) => !row.parent_id), [taxonomyRows]);
  const categoryNames = useMemo(() => [...new Set([
    ...topCategories.map((row) => row.name),
    ...data.map((row) => row.category).filter(Boolean).filter((name) =>
      !allCategoryRows.some((category) => category.name.toLocaleLowerCase() === name.toLocaleLowerCase())
    ),
  ])].sort((a, b) => a.localeCompare(b)), [topCategories, data]);
  const filterCategoryNames = useMemo(() => [...new Set([
    ...allCategoryRows.map((row) => row.name),
    ...data.map((row) => row.category).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b)), [allCategoryRows, data]);
  const visibleData = useMemo(() => data.filter((record) => {
    const text = [record.name, record.code, record.category, record.subcategory, record.material, record.color].filter(Boolean).join(" ").toLocaleLowerCase();
    if (search && !text.includes(search.trim().toLocaleLowerCase())) return false;
    if (categoryFilter && record.category !== categoryFilter) return false;
    if (activeFilter === "active" && record.active === false) return false;
    if (activeFilter === "inactive" && record.active !== false) return false;
    return true;
  }), [data, search, categoryFilter, activeFilter]);

  function changeField(field, value) {
    setForm((current) => {
      if (field.key === "category" && current.category !== value) return { ...current, category: value, subcategory: "" };
      return { ...current, [field.key]: value };
    });
  }

  function fieldOptions(field) {
    if (field.type === "category") {
      const names = [...categoryNames];
      if (form?.category && !names.includes(form.category)) names.unshift(form.category);
      return [{ value: "", label: categoryNames.length ? "Selecione uma categoria" : "Cadastre uma categoria no painel acima" }, ...[...new Set(names)].map((name) => ({ value: name, label: name }))];
    }
    if (field.type === "subcategory") {
      const category = topCategories.find((row) => row.name === form?.category);
      const names = [
        ...taxonomy.filter((row) => category && row.parent_id === category.id).map((row) => row.name),
        ...data.filter((row) => row.category === form?.category).map((row) => row.subcategory).filter(Boolean),
      ];
      if (form?.subcategory && !names.includes(form.subcategory)) names.unshift(form.subcategory);
      return [{ value: "", label: category ? "Selecione uma subcategoria" : "Escolha primeiro a categoria" }, ...[...new Set(names)].map((name) => ({ value: name, label: name }))];
    }
    return field.options;
  }

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
    if (categoryScope && !form?.id && !String(form?.category || "").trim()) {
      toast.error("Escolha uma categoria antes de salvar o novo cadastro.");
      return;
    }
    if (!String(form?.name || "").trim()) {
      toast.error("Informe o nome do item.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      payload.name = payload.name.trim();
      if (entity === "CustomProduct") {
        payload.variations = (Array.isArray(payload.variations) ? payload.variations : [])
          .map((variation) => ({
            ...variation,
            name: String(variation.name || "").trim(),
            options: (variation.options || []).filter((option) => String(typeof option === "string" ? option : option.label || "").trim()).map((option) => ({
              ...(typeof option === "string" ? { label: option, price_delta: 0 } : option),
              label: String(typeof option === "string" ? option : option.label).trim(),
              price_delta: Math.max(0, Number(typeof option === "string" ? 0 : option.price_delta) || 0),
            })),
          }))
          .filter((variation) => variation.name && variation.options.length);
      }
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

      <div className={categoryScope ? "mt-4 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_minmax(170px,220px)_minmax(150px,180px)]" : "mt-4 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_minmax(150px,180px)]"}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Buscar por nome, código ou material" aria-label="Buscar no catálogo" />
        {categoryScope ? (
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todas as categorias</option>
            {filterCategoryNames.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        ) : null}
        <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
          <option value="all">Ativos e inativos</option><option value="active">Somente ativos</option><option value="inactive">Somente inativos</option>
        </select>
      </div>

      <div className="mt-2 text-xs text-muted-foreground">{visibleData.length} item(ns) nesta página</div>

      <div className="mt-3 hidden overflow-x-auto rounded-xl border border-border md:block">
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
            {visibleData.map((record) => (
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
                  {!hideDuplicate(record) && <button type="button" onClick={() => duplicate(record)} className="rounded p-1.5 text-muted-foreground hover:text-foreground" aria-label="Duplicar">
                    <Copy className="h-3.5 w-3.5" />
                  </button>}
                  <button type="button" onClick={() => remove(record)} className="rounded p-1.5 text-muted-foreground hover:text-red-600" aria-label="Excluir">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!visibleData.length && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {isPending ? "Carregando catálogo…" : error ? "Não foi possível carregar o catálogo." : "Nenhum registro ainda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-3 md:hidden">
        {visibleData.map((record) => (
          <article key={record.id} className="rounded-xl border border-border bg-card p-3">
            <h3 className="font-medium">{columns[0]?.format ? columns[0].format(record[columns[0].key], record) : String(record[columns[0]?.key] ? record[columns[0].key] : "—")}</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
              {columns.slice(1, 5).map((column) => (
                <div key={column.key} className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{column.label}</dt>
                  <dd className="truncate text-xs">{column.format ? column.format(record[column.key], record) : String(record[column.key] ?? "—")}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-2">
              <Button size="sm" variant="outline" onClick={() => startEdit(record)}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar</Button>
              {!hideDuplicate(record) && <Button size="sm" variant="ghost" onClick={() => duplicate(record)}><Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicar</Button>}
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(record)}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir</Button>
            </div>
          </article>
        ))}
        {!visibleData.length && <p className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">{isPending ? "Carregando catálogo…" : error ? "Não foi possível carregar o catálogo." : "Nenhum item encontrado."}</p>}
      </div>

      {error && <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">Tentar novamente</Button>}
      {hasNextPage && <Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={() => fetchNextPage()} className="mt-3">{isFetchingNextPage ? "Carregando…" : "Carregar mais"}</Button>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-h-[90dvh] overflow-y-auto p-4 sm:max-w-3xl sm:p-6">
          <DialogTitle className="font-display text-xl">{form?.id ? "Editar" : "Novo"} · {title}</DialogTitle>
          {form && (
            <div className="mt-4 space-y-4">
              {sections ? sections.map((section) => (
                <section key={section.title} className="rounded-xl border border-border bg-card/60 p-3 sm:p-4">
                  <div className="mb-3">
                    <h3 className="font-medium">{section.title}</h3>
                    {section.description ? <p className="mt-1 text-xs text-muted-foreground">{section.description}</p> : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {section.fields.map((key) => fields.find((field) => field.key === key)).filter(Boolean).map((field) => {
                      const wide = field.fullWidth || ["textarea", "image", "gallery", "list", "variations"].includes(field.type);
                      return (
                        <div key={field.key} className={wide ? "block sm:col-span-2" : "block"}>
                          <span className="text-xs text-muted-foreground">{field.label}</span>
                          <div className="mt-1">
                            <FieldInput field={field} value={form[field.key]} options={fieldOptions(field)} disabled={field.type === "subcategory" && !form.category} onChange={(value) => changeField(field, value)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )) : fields.map((field) => (
                <div key={field.key} className="block">
                  <span className="text-xs text-muted-foreground">{field.label}</span>
                  <div className="mt-1">
                    <FieldInput
                      field={field}
                      value={form[field.key]}
                      options={fieldOptions(field)}
                      onChange={(value) => changeField(field, value)}
                    />
                  </div>
                </div>
              ))}
              <div className="sticky bottom-[-1rem] -mx-4 flex justify-end gap-2 border-t border-border bg-card/95 px-4 py-3 pt-3 backdrop-blur sm:bottom-[-1.5rem] sm:-mx-6 sm:px-6">
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
