import { useState } from "react";
import { toast } from "sonner";
import { RegisterPage } from "@/components/auth/RegisterPage";
import { getEmployeeAccountState, registerEmployee } from "@/lib/team-fns";

export default function EmployeeForm({ onSaved }) {
  const [jobTitle, setJobTitle] = useState("Funcionário");
  const [version, setVersion] = useState(0);

  async function complete(profile) {
    await registerEmployee({ data: { ...profile, job_title: jobTitle } });
    toast.success("Funcionário cadastrado com acesso ao painel.");
    await onSaved();
    setJobTitle("Funcionário");
    setVersion((current) => current + 1);
  }

  return (
    <section className="card-glass p-5">
      <RegisterPage key={version} managedAccount={{
        beforeRegister: ({ email }) => getEmployeeAccountState({ data: { email } }),
        onComplete: complete,
        fields: (busy) => (
          <label className="block space-y-2 text-sm font-medium">
            <span>Função</span>
            <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)}
              disabled={busy} maxLength={60} placeholder="Atendimento, produção, gerente…"
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" />
          </label>
        ),
      }} />
    </section>
  );
}