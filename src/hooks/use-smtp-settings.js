import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getSmtpSettings, saveSmtpSettings, setSmtpEnabled } from "@/lib/smtp-fns";
import { sendTestEmail } from "@/lib/email-fns";

export function useSmtpSettings() {
  const load = useServerFn(getSmtpSettings);
  const save = useServerFn(saveSmtpSettings);
  const setEnabled = useServerFn(setSmtpEnabled);
  const test = useServerFn(sendTestEmail);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["smtp-settings"], queryFn: () => load() });
  const mutation = useMutation({ mutationFn: (data) => save({ data }) });
  const enabledMutation = useMutation({ mutationFn: (enabled) => setEnabled({ data: { enabled } }) });
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    if (query.data) setForm({ ...query.data, password: "" });
  }, [query.data]);

  async function submit(withTest = false) {
    setError("");
    setTesting(withTest);
    try {
      const saved = await mutation.mutateAsync(form);
      queryClient.setQueryData(["smtp-settings"], saved);
      setForm({ ...saved, password: "" });
      if (withTest) {
        const result = await test();
        await queryClient.invalidateQueries({ queryKey: ["smtp-settings"] });
        if (!result.ok) throw new Error(result.message);
        toast.success(result.message);
      } else toast.success("Configuração SMTP salva.");
    } catch (failure) {
      const message = failure.message || "Não foi possível salvar ou enviar pelo SMTP.";
      setError(message);
      toast.error(message);
    } finally {
      setTesting(false);
    }
  }

  async function toggleEnabled(enabled) {
    setError("");
    try {
      const saved = await enabledMutation.mutateAsync(enabled);
      queryClient.setQueryData(["smtp-settings"], saved);
      setForm((current) => ({ ...current, ...saved, password: "" }));
      toast.success(enabled ? "Serviço SMTP ativado." : "Serviço SMTP desativado.");
    } catch (failure) {
      const message = failure.message || "Não foi possível alterar o serviço SMTP.";
      setError(message);
      toast.error(message);
    }
  }

  return { form, setForm, submit, toggleEnabled, toggling: enabledMutation.isPending, testing, saving: mutation.isPending, loading: query.isPending, error: error || query.error?.message, reload: query.refetch };
}
