import { createFileRoute } from "@tanstack/react-router";
import { ensureDatabase, getPool } from "@/lib/vps/db.server";
import { hasStaffAccess } from "@/lib/staff-access";

const CURSOR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const headers = { "cache-control": "no-store" };
const CHANNEL = "paracolor_order_alerts";
const encoder = new TextEncoder();

async function openAlertStream(request, after) {
  const client = await getPool().connect();
  try {
    await client.query(`LISTEN ${CHANNEL}`);
  } catch {
    client.release();
    return Response.json({ error: "Não foi possível iniciar os avisos em tempo real." }, { status: 503, headers });
  }

  let keepalive;
  let closed = false;
  let controllerRef;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(keepalive);
    client.removeListener("notification", onNotification);
    client.removeListener("error", cleanup);
    request.signal.removeEventListener("abort", cleanup);
    void client.query(`UNLISTEN ${CHANNEL}`).catch(() => {}).finally(() => client.release());
    try { controllerRef?.close(); } catch { /* conexão encerrada pelo navegador */ }
  };
  const send = (value) => {
    if (closed || !controllerRef) return;
    try { controllerRef.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`)); }
    catch { cleanup(); }
  };
  const onNotification = (message) => {
    if (message.channel === CHANNEL && message.payload) send({ id: message.payload });
  };
  client.on("notification", onNotification);
  client.on("error", cleanup);

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      request.signal.addEventListener("abort", cleanup, { once: true });
      send({ ready: true });
      keepalive = setInterval(() => {
        if (!closed) {
          try { controller.enqueue(encoder.encode(": keep-alive\n\n")); }
          catch { cleanup(); }
        }
      }, 25_000);
      void client.query(
        `SELECT order_id FROM vps_order_alerts
         WHERE NOT is_legacy AND created_at > $1::timestamptz
         ORDER BY created_at, order_id LIMIT 1000`,
        [after],
      ).then(({ rows }) => {
        if (rows.length) send({ ids: rows.map(({ order_id }) => order_id) });
      }).catch(() => cleanup());
    },
    cancel: cleanup,
  });

  if (request.signal.aborted) cleanup();
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

export const Route = createFileRoute("/api/admin/order-alerts")({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        if (!hasStaffAccess(context.user, "orders")) {
          return Response.json({ error: "Acesso restrito." }, { status: 403, headers });
        }
        const params = new URL(request.url).searchParams;
        const after = params.get("after");
        if (params.get("stream") === "1") {
          if (!after || !CURSOR.test(after)) {
            return Response.json({ error: "Referência de consulta inválida." }, { status: 400, headers });
          }
          await ensureDatabase();
          return openAlertStream(request, after);
        }
        if (after !== null && !CURSOR.test(after)) {
          return Response.json({ error: "Referência de consulta inválida." }, { status: 400, headers });
        }
        await ensureDatabase();
        const { rows } = await getPool().query(
          `WITH clock AS (
             SELECT to_char((statement_timestamp() - interval '2 seconds') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cutoff
           )
           SELECT cutoff, COALESCE((
             SELECT json_agg(order_id ORDER BY created_at, order_id)
             FROM vps_order_alerts
             WHERE NOT is_legacy AND $1::text IS NOT NULL
               AND created_at > $1::timestamptz AND created_at <= cutoff::timestamptz
           ), '[]'::json) AS ids FROM clock`,
          [after],
        );
        return Response.json(rows[0], { headers });
      },
    },
  },
});
