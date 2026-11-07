import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import ClientEditDialog from "@/components/admin/ClientEditDialog";
import DeletionRequestsPanel from "@/components/admin/DeletionRequestsPanel";
import { formatBRL } from "@/lib/areas";
import { toArray } from "@/lib/collection-utils";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Paracolor" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const [editing, setEditing] = useState(null);
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => toArray(await base44.entities.User.list()),
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => toArray(await base44.entities.Order.list({ sort: "-created_date", limit: 300 })),
  });

  const rows = users.map((user) => {
    const userOrders = orders.filter((order) => order.customer_email === user.email);
    const spent = userOrders
      .filter((order) => order.payment_status === "aprovado")
      .reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    return { ...user, orderCount: userOrders.length, spent, last: userOrders[0]?.created_date };
  });

  return (
    <div>
      <p className="eyebrow">Relacionamento</p>
      <h1 className="mt-1 text-3xl">Clientes</h1>
      <p className="mt-1 text-sm text-muted-foreground">{rows.length} contas cadastradas</p>

      <DeletionRequestsPanel />

      <div className="mt-5 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">E-mail</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2">Perfil</th>
              <th className="px-3 py-2">Pedidos</th>
              <th className="px-3 py-2 text-right">Total pago</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2">{row.full_name || "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{row.email}</td>
                <td className="px-3 py-2 text-xs">{row.phone || "—"}</td>
                <td className="px-3 py-2 text-xs">{row.role || "user"}</td>
                <td className="px-3 py-2 text-xs">{row.orderCount}</td>
                <td className="px-3 py-2 text-right">{formatBRL(row.spent)}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditing(row)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-xs text-muted-foreground">Nenhum cliente cadastrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ClientEditDialog
        client={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => (open ? null : setEditing(null))}
      />
    </div>
  );
}
