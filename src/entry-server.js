import { scheduleFileRetention } from "@/lib/file-retention.server";
import { sendPendingOrderNotices } from "@/lib/order-notices.server";
import { pollSicoobPayments } from "@/lib/payment-attempts.server";
import { makeServerBase44 } from "@/lib/vps/server-client.server";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { startBackupScheduler } from "@/lib/backup.server";

startBackupScheduler();

if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
  let busy = false;
  let retentionBusy = false;
  setInterval(async () => {
    if (retentionBusy) return;
    retentionBusy = true;
    try { await scheduleFileRetention(); }
    catch (error) { console.error("Falha na retenção automática:", error.code || error.message); }
    finally { retentionBusy = false; }
  }, 60_000).unref();
  setInterval(() => {
    void sendPendingOrderNotices(makeServerBase44(new Request("http://localhost")))
      .catch((error) => console.error("Falha na fila de e-mails:", error.code || error.message));
  }, 60_000).unref();
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await pollSicoobPayments(makeServerBase44(new Request("http://localhost"))); }
    catch { /* a temporary database outage is retried at the next interval */ }
    finally { busy = false; }
  }, 60_000).unref();
}

export default createServerEntry({
  async fetch(request, options) {
    const response = await handler.fetch(request, options);
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    if (headers.get("content-type")?.includes("text/html")) {
      headers.set("Content-Security-Policy", "base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
      headers.set("X-Frame-Options", "DENY");
    }
    if (process.env.SECURITY_HSTS === "true" && /^https:\/\//i.test(process.env.PUBLIC_APP_URL || "")) {
      headers.set("Strict-Transport-Security", "max-age=7776000");
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
});
