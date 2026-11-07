import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getSmtpSettings, saveSmtpSettings } from "@/lib/smtp-fns";
import { sendTestEmail } from "@/lib/email-fns";

export function useSmtpSettings() {
  const load = useServerFn(getSmtpSettings);
  const save = useServerFn(saveSmtpSettings);
  const test = useServerFn(sendTestEmail);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["smtp-settings"], queryFn: () => load() });
  const mutation = useMutation({ mutationFn: (data) => save({ data }) });
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

  return { form, setForm, submit, testing, saving: mutation.isPending, loading: query.isPending, error: error || query.error?.message, reload: query.refetch };
}