import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import EmployeeForm from "@/components/admin/EmployeeForm";
import EmployeeRow from "@/components/admin/EmployeeRow";
import { listEmployees } from "@/lib/team-fns";

export const Route = createFileRoute("/admin/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Paracolor" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { data: employees = [], isLoading, error, refetch } = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees(),
  });

  return (
    <div>
      <p className="eyebrow">Equipe</p>
      <h1 className="mt-1 text-3xl">Funcionários do painel</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Cada funcionário entra no painel com o próprio e-mail. Toda ação feita por ele fica assinada no pedido — status, prazo
        e aprovação de arte — mostrando quem foi o responsável.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="card-glass p-5">
          <h2 className="text-lg">Equipe cadastrada</h2>
          {isLoading ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando equipe…
            </p>
          ) : error ? (
            <p className="mt-4 text-sm text-destructive">Não foi possível carregar a equipe.</p>
          ) : employees.length ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Funcionário</th>
                    <th className="px-3 py-2">Telefone</th>
                    <th className="px-3 py-2">Função</th>
                    <th className="px-3 py-2">Acesso</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <EmployeeRow key={employee.id} employee={employee} onChanged={refetch} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Nenhum funcionário cadastrado ainda.</p>
          )}
        </section>

        <EmployeeForm onSaved={refetch} />
      </div>
    </div>
  );
}