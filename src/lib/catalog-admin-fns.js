import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { withTransaction } from "@/lib/vps/db.server";

export const organizeCatalog = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.discriminatedUnion("action", [
    z.object({ action: z.literal("rename"), id: z.string().min(1), name: z.string().trim().min(1).max(100) }),
    z.object({ action: z.literal("move"), id: z.string().min(1), destination: z.string().min(1) }),
  ]))
  .handler(async ({ data, context }) => {
    if (context.user.role !== "admin") throw new Error("Acesso restrito.");
    return withTransaction(async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended('paracolor-catalog',0))");
      const { rows } = await db.query("SELECT id,data FROM vps_records WHERE entity='CatalogCategory'");
      const source = rows.find((row) => row.id === data.id);
      if (!source) throw new Error("Categoria não encontrada.");
      const current = source.data;
      const parent = rows.find((row) => row.id === current.parent_id)?.data;
      const entity = current.scope === "molduras" ? "Frame" : "CustomProduct";
      const category = parent?.name || current.name;
      const subcategory = parent ? current.name : "";
      let patch;
      if (data.action === "rename") {
        if (rows.some(({ id, data: row }) => id !== source.id && row.scope === current.scope
          && (row.parent_id || "") === (current.parent_id || "") && row.name.toLowerCase() === data.name.toLowerCase())) {
          throw new Error("Já existe uma categoria com esse nome.");
        }
        await db.query("UPDATE vps_records SET data=data || $2::jsonb,updated_at=now() WHERE entity='CatalogCategory' AND id=$1",
          [source.id, { name: data.name }]);
        patch = parent ? { subcategory: data.name } : { category: data.name };
      } else {
        const target = rows.find((row) => row.id === data.destination)?.data;
        if (!target || target.scope !== current.scope || target.active === false || data.destination === data.id) {
          throw new Error("Selecione outra categoria ativa.");
        }
        const targetParent = rows.find((row) => row.id === target.parent_id)?.data;
        if (targetParent?.active === false) throw new Error("A categoria principal do destino está desativada.");
        patch = { category: targetParent?.name || target.name, subcategory: targetParent ? target.name : "" };
      }
      const { rowCount } = await db.query(
        `UPDATE vps_records SET data=data || $4::jsonb,updated_at=now()
         WHERE entity=$1 AND data->>'category'=$2 AND ($3='' OR data->>'subcategory'=$3)`,
        [entity, category, subcategory, patch],
      );
      return { count: rowCount };
    });
  });
