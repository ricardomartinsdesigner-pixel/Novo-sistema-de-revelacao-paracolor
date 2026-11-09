import { toArray } from "@/lib/collection-utils";
import { isProfessional } from "@/lib/order-payment";
import { checkProfessionalTable, professionalPricingData, PROFESSIONAL_TABLE_ID } from "@/lib/professional-pricing";
import { ensureDatabase, getPool } from "@/lib/vps/db.server";

export async function professionalPricingRecord(role) {
  return toArray(await role.entities.ProfessionalPricing.filter({ id: PROFESSIONAL_TABLE_ID }, { limit: 1 }))[0];
}

export async function loadProfessionalPricing(role, user) {
  if (!isProfessional(user)) return null;
  const record = await professionalPricingRecord(role);
  return professionalPricingData(record?.published);
}

export async function saveProfessionalPricingRecord(role, user, { table, publish, revision }) {
  if (publish) {
    const sizes = toArray(await role.entities.PhotoSize.list({ limit: 1000 })).filter((size) => !size.is_photo_3x4);
    const { issue, missing } = checkProfessionalTable(table, sizes);
    if (issue || missing.length) {
      throw new Error(issue || "Preencha todos os preços dos tamanhos ativos antes de publicar.");
    }
  }

  const updated = {
    draft: table,
    revision: revision + 1,
    ...(publish ? { published: table, published_at: new Date().toISOString() } : {}),
  };
  await ensureDatabase();
  const db = getPool();
  const result = revision === 0
    ? await db.query(
      "INSERT INTO vps_records(entity, id, created_by_id, data) VALUES ('ProfessionalPricing', $1, $2, $3) ON CONFLICT DO NOTHING RETURNING data",
      [PROFESSIONAL_TABLE_ID, user.id, updated],
    )
    : await db.query(
      "UPDATE vps_records SET data = data || $2::jsonb, updated_at = now() WHERE entity = 'ProfessionalPricing' AND id = $1 AND data->>'revision' = $3 RETURNING data",
      [PROFESSIONAL_TABLE_ID, updated, String(revision)],
    );
  if (!result.rowCount) throw new Error("Outra pessoa salvou esta tabela. Recarregue a página para ver a versão mais recente.");
  return result.rows[0].data;
}
