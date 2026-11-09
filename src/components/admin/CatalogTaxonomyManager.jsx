import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { organizeCatalog } from "@/lib/catalog-admin-fns";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useEntityList } from "@/lib/store";

const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

export default function CatalogTaxonomyManager({ scope, title }) {
  const queryClient = useQueryClient();
  const { data: rows = [] } = useEntityList("CatalogCategory", { scope }, { sort: "sort", limit: 500 });
  const entity = scope === "molduras" ? "Frame" : "CustomProduct";
  const productFilter = scope === "albuns_books"
    ? { catalog_type: { $in: ["album", "book"] } }
    : scope === "personalizados" ? { catalog_type: { $nin: ["album", "book"] } } : {};
  const { data: products = [] } = useEntityList(entity, productFilter, { sort: "created_date", limit: 1000 });
  const [name, setName] = useState("");
  const [rename, setRename] = useState({ id: "", name: "" });
  const [move, setMove] = useState({ id: "", destination: "" });
  const [saving, setSaving] = useState(false);
  const [childName, setChildName] = useState({});
  const categories = rows.filter((row) => !row.parent_id);
  const legacyCategories = [...new Set(products.map((row) => row.category).filter(Boolean))]
    .filter((value) => !categories.some((category) => category.name.toLocaleLowerCase() === value.toLocaleLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  async function createCategory(value) {
    if (!value) return;
    if (categories.some((row) => row.name.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      toast.error("Essa categoria já existe.");
      return;
    }
    try {
      const created = await base44.entities.CatalogCategory.create({ scope, name: value, parent_id: "", active: true, sort: categories.length * 10 });
      const legacySubcategories = [...new Map(
        products.filter((row) => String(row.category || "").toLocaleLowerCase() === value.toLocaleLowerCase())
          .map((row) => row.subcategory).filter(Boolean).map((label) => [label.toLocaleLowerCase(), label])
      ).values()];
      for (const subcategory of legacySubcategories) {
        await base44.entities.CatalogCategory.create({ scope, parent_id: created.id, name: subcategory, active: true, sort: 0 });
      }
      await queryClient.invalidateQueries({ queryKey: ["CatalogCategory"] });
      toast.success("Categoria adicionada");
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: ["CatalogCategory"] });
      toast.error(error?.message || "Não foi possível adicionar a categoria.");
    }
  }

  async function addCategory(event) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    await createCategory(value);
    setName("");
  }

  async function addSubcategory(event, category) {
    event.preventDefault();
    const value = String(childName[category.id] || "").trim();
    if (!value) return;
    const children = rows.filter((row) => row.parent_id === category.id);
    if (children.some((row) => row.name.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      toast.error("Essa subcategoria já existe nesta categoria.");
      return;
    }
    try {
      await base44.entities.CatalogCategory.create({ scope, parent_id: category.id, name: value, active: true, sort: children.length * 10 });
      setChildName((current) => ({ ...current, [category.id]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["CatalogCategory"] });
      toast.success("Subcategoria adicionada");
    } catch (error) {
      toast.error(error?.message || "Não foi possível adicionar a subcategoria.");
    }
  }

  async function toggleActive(row) {
    try {
      await base44.entities.CatalogCategory.update(row.id, { active: row.active === false });
      await queryClient.invalidateQueries({ queryKey: ["CatalogCategory"] });
      toast.success(row.active === false ? "Opção reativada" : "Opção desativada");
    } catch (error) {
      toast.error(error?.message || "Não foi possível atualizar a opção.");
    }
  }

  function choices(exclude = "") {
    return rows.filter((row) => row.id !== exclude && row.active !== false).map((row) => {
      const parent = rows.find((entry) => entry.id === row.parent_id);
      return <option key={row.id} value={row.id}>{parent ? parent.name + " / " : ""}{row.name}</option>;
    });
  }

  async function organize(event, action, payload) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await organizeCatalog({ data: { action, ...payload } });
      await Promise.all(["CatalogCategory", entity].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      toast.success(`${result.count} cadastro(s) atualizados.`);
    } catch (error) {
      toast.error(error.message || "Não foi possível organizar a categoria.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="mb-5 rounded-xl border border-border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-medium">Organizar categorias e subcategorias</span>
        <span className="ml-2 text-xs text-muted-foreground">{title}</span>
        <span className="float-right text-xs text-muted-foreground">Toque para abrir ou fechar</span>
      </summary>
      <div className="border-t border-border p-4">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Adicione aqui as opções que aparecerão nos formulários. Desativar uma opção a remove das novas escolhas sem alterar os produtos já cadastrados.
        </p>
        <form onSubmit={addCategory} className="flex flex-col gap-2 sm:flex-row">
          <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Nova categoria" aria-label="Nome da nova categoria" />
          <Button type="submit" className="shrink-0 gap-1.5"><Plus className="h-4 w-4" /> Adicionar categoria</Button>
        </form>
        {legacyCategories.length > 0 && (
          <div className="mt-3 rounded-lg bg-secondary/60 p-3">
            <p className="text-[11px] text-muted-foreground">Categorias já usadas nos cadastros antigos. Importe para também organizar subcategorias:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {legacyCategories.map((legacy) => (
                <button key={legacy} type="button" onClick={() => createCategory(legacy)} className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:border-primary">
                  <Plus className="mr-1 inline h-3 w-3" /> {legacy}
                </button>
              ))}
            </div>
          </div>
        )}

        {rows.length > 0 && <details className="mt-4 rounded-lg border p-3">
          <summary className="cursor-pointer text-sm">Renomear ou mover em lote</summary>
          <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={(event) => organize(event, "rename", rename)}>
            <select aria-label="Categoria para renomear" value={rename.id} required className={inputClass}
              onChange={(event) => setRename({ id: event.target.value, name: rows.find((row) => row.id === event.target.value)?.name || "" })}>
              <option value="">Renomear categoria</option>{choices()}
            </select>
            <input aria-label="Novo nome" value={rename.name} required maxLength={100} className={inputClass}
              onChange={(event) => setRename({ ...rename, name: event.target.value })} />
            <Button type="submit" variant="outline" disabled={saving}>Renomear</Button>
          </form>
          <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={(event) => {
            event.preventDefault();
            if (window.confirm("Mover todos os cadastros da categoria selecionada?")) void organize(event, "move", move);
          }}>
            <select aria-label="Categoria de origem" value={move.id} required className={inputClass}
              onChange={(event) => setMove({ id: event.target.value, destination: "" })}>
              <option value="">Categoria de origem</option>{choices()}
            </select>
            <select aria-label="Categoria de destino" value={move.destination} required className={inputClass}
              onChange={(event) => setMove({ ...move, destination: event.target.value })}>
              <option value="">Categoria de destino</option>{choices(move.id)}
            </select>
            <Button type="submit" variant="outline" disabled={saving}>Mover cadastros</Button>
          </form>
        </details>}
        <div className="mt-4 space-y-3">
          {categories.map((category) => {
            const children = rows.filter((row) => row.parent_id === category.id);
            return (
              <section key={category.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={category.active === false ? "font-medium text-muted-foreground line-through" : "font-medium"}>{category.name}</p>
                  <button type="button" onClick={() => toggleActive(category)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary" aria-label={(category.active === false ? "Reativar " : "Desativar ") + category.name}>
                    {category.active === false ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4 text-emerald-600" />}
                    {category.active === false ? "Desativada" : "Ativa"}
                  </button>
                </div>
                {children.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {children.map((child) => (
                      <span key={child.id} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs">
                        <span className={child.active === false ? "text-muted-foreground line-through" : ""}>{child.name}</span>
                        <button type="button" onClick={() => toggleActive(child)} className="rounded-full p-0.5 text-muted-foreground hover:bg-secondary" aria-label={(child.active === false ? "Reativar " : "Desativar ") + child.name}>
                          {child.active === false ? <ToggleLeft className="h-3.5 w-3.5" /> : <ToggleRight className="h-3.5 w-3.5 text-emerald-600" />}
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <form onSubmit={(event) => addSubcategory(event, category)} className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input value={childName[category.id] || ""} onChange={(event) => setChildName((current) => ({ ...current, [category.id]: event.target.value }))} className={inputClass} placeholder={"Nova subcategoria em " + category.name} aria-label={"Nova subcategoria em " + category.name} />
                  <Button type="submit" variant="outline" size="sm" className="shrink-0 gap-1.5"><Plus className="h-3.5 w-3.5" /> Subcategoria</Button>
                </form>
              </section>
            );
          })}
          {!categories.length && <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Ainda não há categorias. Cadastre a primeira acima.</p>}
        </div>
      </div>
    </details>
  );
}
