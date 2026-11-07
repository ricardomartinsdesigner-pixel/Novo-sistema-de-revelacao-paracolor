import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { startBackupScheduler } from "@/lib/backup.server";

startBackupScheduler();

export default createServerEntry({
  fetch(request, options) {
    return handler.fetch(request, options);
  },
});
