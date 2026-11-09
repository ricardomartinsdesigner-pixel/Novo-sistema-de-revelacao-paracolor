import { useState } from "react";
import { toast } from "sonner";
import { RegisterPage } from "@/components/auth/RegisterPage";
import { getEmployeeAccountState, registerEmployee } from "@/lib/team-fns";
import { STAFF_ROLES, roleLabel } from "@/lib/staff-access";

export default function EmployeeForm({ onSaved }) {
  const [jobTitle, setJobTitle] = useState("Funcionário");
  const [accessRole, setAccessRole] = useState("atendimento");
  const [version, setVersion] = useState(0);

  async function complete(profile) {
    await registerEmployee({ data: { ...profile, job_title: jobTitle, access_role: accessRole } });
    toast.success("Funcionário cadastrado com acesso ao painel.");
    await onSaved();
    setJobTitle("Funcionário");
    setAccessRole("atendimento");
    setVersion((current) => current + 1);
  }

  return (
    <section className="card-glass p-5">
      <RegisterPage key={version} managedAccount={{
        beforeRegister: ({ email }) => getEmployeeAccountState({ data: { email } }),
        onComplete: complete,
        fields: (busy) => (
          <div>
          <label className="block space-y-2 text-sm font-medium">
            <span>Função</span>
            <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)}
              disabled={busy} maxLength={60} placeholder="Atendimento, produção, gerente…"
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" />
          </label>
          <label className="mt-3 block space-y-2 text-sm font-medium">
            <span>Nível de acesso</span>
            <select value={accessRole} onChange={(event) => setAccessRole(event.target.value)} disabled={busy}
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm font-normal">
              {STAFF_ROLES.filter((role) => role !== "admin").map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select>
            <span className="block text-xs font-normal text-muted-foreground">Atendimento gerencia pedidos e dados de clientes. Produção acessa filas e prazos. Gerência inclui entregas, pagamentos e relatórios. Somente administradores alteram configurações.</span>
          </label>
          </div>
        ),
      }} />
    </section>
  );
}
