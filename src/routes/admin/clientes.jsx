import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClientEditDialog from "@/components/admin/ClientEditDialog";
import DeletionRequestsPanel from "@/components/admin/DeletionRequestsPanel";
import { formatBRL } from "@/lib/areas";
import { findClients } from "@/lib/account-fns";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Paracolor" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const { user } = useAuth();
  const canEditClients = user?.role === "admin";
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [professional, setProfessional] = useState(false);
  const find = useServerFn(findClients);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const results = useInfiniteQuery({
    queryKey: ["admin-users", "search", term, professional],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => find({ data: { term, offset: pageParam, professional } }),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
  const loading = search.trim() !== term || results.isPending;
  const rows = loading ? [] : results.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div>
      <p className="eyebrow">Relacionamento</p>
      <h1 className="mt-1 text-3xl">Clientes</h1>
      <div className="mt-4 flex max-w-lg gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar por nome, telefone ou e-mail</span>
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
            maxLength={160} placeholder="Buscar por nome, telefone ou e-mail"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-2 text-sm" />
        </label>
        {search && <Button variant="outline" onClick={() => { setSearch(""); setTerm(""); }}>Limpar</Button>}
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={professional} onChange={(event) => setProfessional(event.target.checked)} /> Apenas fotógrafos profissionais</label>
      <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
        {loading ? "Buscando clientes…" : results.isError ? "Não foi possível carregar os clientes." : `${results.data.pages[0].total} cliente(s) encontrado(s)`}
      </p>

      {canEditClients ? <DeletionRequestsPanel /> : null}

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
                <td className="px-3 py-2 text-xs">
                  {row.professional_pricing === true ? (
                    <>
                      <span className="rounded-full bg-primary px-2 py-1 font-medium text-primary-foreground">Fotógrafo profissional</span>
                      {row.allow_pickup_payment === true && <span className="mt-1 block text-muted-foreground">Pagamento na retirada autorizado</span>}
                    </>
                  ) : row.role === "admin" ? "Administrador" : "Cliente"}
                </td>
                <td className="px-3 py-2 text-xs">{row.orderCount}</td>
                <td className="px-3 py-2 text-right">{formatBRL(row.spent)}</td>
                <td className="px-3 py-2 text-right">
                  {canEditClients ? <Button size="sm" variant="outline" onClick={() => setEditing(row)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button> : <span className="text-xs text-muted-foreground">Consulta</span>}
                </td>
              </tr>
            ))}
            {!rows.length && !loading && !results.isError && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-muted-foreground">Nenhum cliente encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {results.isError && <Button className="mt-3" variant="outline" onClick={() => results.refetch()}>Tentar novamente</Button>}
      {!loading && results.hasNextPage && (
        <Button className="mt-3" variant="outline" disabled={results.isFetchingNextPage} onClick={() => results.fetchNextPage()}>
          {results.isFetchingNextPage ? "Carregando…" : "Carregar mais clientes"}
        </Button>
      )}

      {canEditClients ? <ClientEditDialog
        client={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => (open ? null : setEditing(null))}
      /> : null}
    </div>
  );
}
