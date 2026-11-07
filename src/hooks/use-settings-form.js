import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useSettings } from "@/lib/store";

/** Loads a slice of the shop settings into a local form and saves it back. */
export function useSettingsForm(build) {
  const { settings, isLoading } = useSettings();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!settings || form) return;
    setForm(build(settings));
  }, [settings, form, build]);

  async function save() {
    setSaving(true);
    try {
      await base44.entities.Settings.update(settings.id, form);
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Alterações salvas");
    } catch (error) {
      toast.error(error?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return { settings, form, setForm, saving, save, isLoading };
}