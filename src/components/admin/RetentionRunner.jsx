import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSettings } from "@/lib/store";
import { purgeOriginals } from "@/lib/store-fns";

const LAST_RUN_KEY = "paracolor.retention.last";
const ONE_DAY = 24 * 60 * 60 * 1000;

/** Runs the original-file retention once a day when an admin opens the panel. */
export default function RetentionRunner() {
  const { settings } = useSettings();
  const purge = useServerFn(purgeOriginals);

  useEffect(() => {
    if (!settings || settings.retention_auto === false) return;
    const days = Number(settings.retention_days) || 0;
    if (days < 1) return;
    const last = Number(localStorage.getItem(LAST_RUN_KEY) || 0);
    if (Date.now() - last < ONE_DAY) return;
    localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
    purge({ data: { days } }).catch(() => {});
  }, [settings, purge]);

  return null;
}