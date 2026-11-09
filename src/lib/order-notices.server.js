import { randomUUID } from "node:crypto";
import { notifyCustomer } from "./email.server.js";
import { makeEntityService } from "./vps/entities.server.js";
import { withTransaction } from "./vps/db.server.js";

export function enqueueOrderNotice(db, orderId, kind) {
  if (!kind) return;
  return db.query(
    "INSERT INTO vps_records(entity,id,data) VALUES('OrderNotice',$1,$2)",
    [randomUUID(), { orderId, kind, attempts: 0 }],
  );
}

let running = false;

export async function sendPendingOrderNotices(base44) {
  if (running) return;
  running = true;
  try {
    for (let count = 0; count < 10; count++) {
      const found = await withTransaction(async (db) => {
        const { rows: [job] } = await db.query(
          `SELECT id, data FROM vps_records WHERE entity='OrderNotice'
           AND NOT (data ? 'finishedAt')
           AND (NOT (data ? 'nextAt') OR (data->>'nextAt')::timestamptz <= now())
           ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
        );
        if (!job) return false;
        const { orderId, kind, attempts } = job.data;
        let result;
        try {
          const service = { ...base44, asServiceRole: makeEntityService(null, true, db) };
          const order = await service.asServiceRole.entities.Order.get(orderId);
          result = await notifyCustomer(service, order, kind);
        } catch (error) {
          result = { sent: false, reason: error.status === 404 ? "pedido removido" : "falha temporária" };
        }
        const next = attempts + 1;
        const final = result.sent || /desativado|sem e-mail|pedido removido|evento desconhecido/i.test(result.reason || "") || next >= 4;
        await db.query("UPDATE vps_records SET data=data || $2::jsonb, updated_at=now() WHERE entity='OrderNotice' AND id=$1", [
          job.id, final ? { attempts: next, finishedAt: new Date().toISOString(), status: result.sent ? "enviado" : "não enviado" }
            : { attempts: next, nextAt: new Date(Date.now() + 60_000 * 5 ** next).toISOString(), status: "tentando novamente" },
        ]);
        return true;
      });
      if (!found) break;
    }
  } finally {
    running = false;
  }
}
