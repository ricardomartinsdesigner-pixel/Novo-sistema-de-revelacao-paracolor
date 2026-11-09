import { createFileRoute } from "@tanstack/react-router";
import { ensureDatabase, getPool } from "@/lib/vps/db.server";
import { enforceRateLimit } from "@/lib/vps/auth.server";
import { isAllowedRequestOrigin } from "@/lib/request-origin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { "cache-control": "no-store" };
const CHANNEL = "paracolor_site_analytics";
let lastRetentionSweep = 0;

export const Route = createFileRoute("/api/analytics/visit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (!isAllowedRequestOrigin(request, origin, process.env.PUBLIC_APP_URL || "")) {
          return Response.json({ error: "Origem inválida." }, { status: 403, headers });
        }
        const contentLength = Number(request.headers.get("content-length") || 0);
        if (contentLength > 4096) return Response.json({ error: "Dados inválidos." }, { status: 413, headers });
        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Dados inválidos." }, { status: 400, headers });
        }
        const id = String(body?.visitor_id || "");
        if (!UUID.test(id) || typeof body?.page_view !== "boolean") {
          return Response.json({ error: "Dados inválidos." }, { status: 400, headers });
        }

        await ensureDatabase();
        try {
          await enforceRateLimit(request, "analytics");
        } catch (error) {
          return Response.json({ error: error.message || "Muitas tentativas." }, { status: error.status || 429, headers });
        }
        const db = getPool();
        if (Date.now() - lastRetentionSweep > 6 * 60 * 60 * 1000) {
          lastRetentionSweep = Date.now();
          const retentionDays = Math.max(90, Math.min(730, Number(process.env.ANALYTICS_RETENTION_DAYS || 400)));
          await db.query("DELETE FROM vps_site_visitor_daily WHERE visit_day < (now() AT TIME ZONE 'UTC')::date - $1::integer", [retentionDays]);
          await db.query("DELETE FROM vps_site_presence WHERE last_seen_at < now() - interval '10 minutes'");
        }
        await db.query(
          `INSERT INTO vps_site_presence(visitor_id, last_seen_at)
           VALUES ($1, now())
           ON CONFLICT(visitor_id) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at`,
          [id],
        );
        await db.query(
          `INSERT INTO vps_site_visitor_daily(visitor_id, visit_day, pageviews, last_pageview_at)
           VALUES ($1, (now() AT TIME ZONE 'UTC')::date, CASE WHEN $2 THEN 1 ELSE 0 END,
                   CASE WHEN $2 THEN now() ELSE NULL END)
           ON CONFLICT(visitor_id, visit_day) DO UPDATE SET
             pageviews = vps_site_visitor_daily.pageviews + CASE
               WHEN $2 AND (vps_site_visitor_daily.last_pageview_at IS NULL OR
                 vps_site_visitor_daily.last_pageview_at < now() - interval '3 seconds') THEN 1 ELSE 0 END,
             last_pageview_at = CASE
               WHEN $2 AND (vps_site_visitor_daily.last_pageview_at IS NULL OR
                 vps_site_visitor_daily.last_pageview_at < now() - interval '3 seconds') THEN now()
               ELSE vps_site_visitor_daily.last_pageview_at END`,
          [id, body.page_view],
        );
        await db.query("SELECT pg_notify($1, $2)", [CHANNEL, "updated"]);
        return Response.json({ ok: true }, { headers });
      },
    },
  },
});
