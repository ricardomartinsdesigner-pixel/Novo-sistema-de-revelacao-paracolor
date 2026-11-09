import { createFileRoute } from "@tanstack/react-router";
import { ensureDatabase, getPool } from "@/lib/vps/db.server";

const CHANNEL = "paracolor_site_analytics";
const encoder = new TextEncoder();

async function readAnalytics() {
  const retentionDays = Math.max(90, Math.min(730, Number(process.env.ANALYTICS_RETENTION_DAYS || 400)));
  const { rows } = await getPool().query(
    `SELECT
       (SELECT COUNT(DISTINCT visitor_id) FROM vps_site_visitor_daily WHERE visit_day >= (now() AT TIME ZONE 'UTC')::date - $1::integer) AS total_visitors,
       (SELECT COALESCE(SUM(pageviews), 0) FROM vps_site_visitor_daily WHERE visit_day >= (now() AT TIME ZONE 'UTC')::date - $1::integer) AS total_pageviews,
       (SELECT COUNT(DISTINCT visitor_id) FROM vps_site_visitor_daily
         WHERE visit_day = (now() AT TIME ZONE 'UTC')::date) AS today_visitors,
       (SELECT COALESCE(SUM(pageviews), 0) FROM vps_site_visitor_daily
         WHERE visit_day = (now() AT TIME ZONE 'UTC')::date) AS today_pageviews,
       (SELECT COUNT(*) FROM vps_site_presence
         WHERE last_seen_at > now() - interval '75 seconds') AS online_now,
       $1::integer AS retention_days,
       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
    [retentionDays],
  );
  return rows[0];
}

async function openAnalyticsStream(request) {
  const client = await getPool().connect();
  try {
    await client.query(`LISTEN ${CHANNEL}`);
  } catch {
    client.release();
    return Response.json({ error: "Não foi possível iniciar a atualização ao vivo." }, { status: 503 });
  }

  let closed = false;
  let controllerRef;
  let keepalive;
  let refreshTimer;
  let refreshPending = false;
  let refreshAgain = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(keepalive);
    clearInterval(refreshTimer);
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
  const refresh = async () => {
    if (closed) return;
    if (refreshPending) {
      refreshAgain = true;
      return;
    }
    refreshPending = true;
    try { send(await readAnalytics()); }
    catch { cleanup(); }
    finally {
      refreshPending = false;
      if (refreshAgain && !closed) {
        refreshAgain = false;
        void refresh();
      }
    }
  };
  const onNotification = (message) => {
    if (message.channel === CHANNEL) void refresh();
  };
  client.on("notification", onNotification);
  client.on("error", cleanup);

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      request.signal.addEventListener("abort", cleanup, { once: true });
      void refresh();
      keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keep-alive\n\n")); }
        catch { cleanup(); }
      }, 20_000);
      // Online visitors age out after 75 seconds, so refresh the displayed count
      // periodically even if no new browser event arrives.
      refreshTimer = setInterval(() => void refresh(), 10_000);
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

export const Route = createFileRoute("/api/admin/site-analytics")({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        if (context.user?.role !== "admin") {
          return Response.json({ error: "Acesso restrito." }, { status: 403, headers: { "cache-control": "no-store" } });
        }
        await ensureDatabase();
        if (new URL(request.url).searchParams.get("stream") === "1") return openAnalyticsStream(request);
        return Response.json(await readAnalytics(), { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
