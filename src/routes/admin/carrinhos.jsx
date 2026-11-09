import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { sendCartReminder } from "@/lib/cart-lead-fns";
import { formatBRL, formatDate } from "@/lib/areas";

const STATUS_LABELS = {
  aberto: "Em aberto",
  lembrete_enviado: "Lembrete enviado",
  descartado: "Descartado",
  recuperado: "Pedido registrado",
};

export const Route = createFileRoute("/admin/carrinhos")({
  head: () => ({ meta: [{ title: "Carrinhos abandonados — Paracolor" }] }),
  component: CarrinhosPage,
});

function CarrinhosPage() {
  const queryClient = useQueryClient();
  const remind = useServerFn(sendCartReminder);
  const [sending, setSending] = useState("");
  const [view, setView] = useState("pendentes");
  const [hours, setHours] = useState("0.5");

  const leadsQuery = useInfiniteQuery({
    queryKey: ["cart-leads", view, hours],
    initialPageParam: { cursor: null },
    queryFn: async ({ pageParam }) => {
      const cutoff = pageParam.cutoff ?? new Date(Date.now() - Number(hours) * 3600000).toISOString();
      const query = view === "recuperados" ? { status: "recuperado" } : {
        status: { $in: ["aberto", "lembrete_enviado"] },
        last_activity: { $lte: cutoff },
      };
      const [result, total] = await Promise.all([
        base44.entities.CartLead.filter(query, { limit: 100, sort: "-last_activity", cursor: pageParam.cursor }),
        pageParam.cursor ? null : base44.entities.CartLead.count(query),
      ]);
      return { items: result.items ?? [], next: result.next_cursor, cutoff, total };
    },
    getNextPageParam: (page) => page.next ? { cursor: page.next, cutoff: page.cutoff } : undefined,
  });
  const leads = leadsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const total = leadsQuery.data?.pages[0].total;

  async function send(lead) {
    setSending(lead.id);
    try {
      const result = await remind({
        data: { id: lead.id },
      });
      if (result.sent) toast.success(`Lembrete enviado para ${lead.customer_email}`);
      else toast.warning(result.reason || "Não foi possível enviar.");
      await queryClient.invalidateQueries({ queryKey: ["cart-leads"] });
    } catch (error) {
      toast.error(error?.message || "Não foi possível enviar.");
    } finally {
      setSending("");
    }
  }

  async function discard(lead) {
    try {
      await base44.entities.CartLead.update(lead.id, { status: "descartado" });
      await queryClient.invalidateQueries({ queryKey: ["cart-leads"] });
      toast.success("Carrinho descartado");
    } catch (error) {
      toast.error(error?.message || "Não foi possível descartar o carrinho.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Operação</p>
        <h1 className="mt-1 text-3xl">Carrinhos abandonados</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Clientes cadastrados que montaram um carrinho e não finalizaram. O lembrete é enviado pelo seu servidor de
          e-mail e usa o texto configurado nas mensagens da loja.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="rounded-lg border bg-background px-3 text-sm" aria-label="Situação do carrinho" value={view} onChange={(event) => setView(event.target.value)}>
          <option value="pendentes">Aguardando atendimento</option><option value="recuperados">Pedidos registrados</option>
        </select>
        {view === "pendentes" && <select className="rounded-lg border bg-background px-3 text-sm" aria-label="Tempo sem atividade"
          value={hours} onChange={(event) => setHours(event.target.value)}>
          <option value="0.5">Sem atividade por 30 min</option><option value="2">Sem atividade por 2 horas</option><option value="24">Sem atividade por 1 dia</option>
        </select>}
        <Button variant="outline" onClick={() => leadsQuery.refetch()} disabled={leadsQuery.isFetching} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {leadsQuery.data && <p className="text-xs text-muted-foreground" aria-live="polite">
        {leads.length} de {total} carrinhos
      </p>}
      {leadsQuery.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os carrinhos. Use Atualizar para tentar novamente.</p>}
      {leadsQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando carrinhos…
        </p>
      ) : leads.length === 0 ? (
        !leadsQuery.isError && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum carrinho abandonado agora.
        </p>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div key={lead.id} className="card-glass p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{lead.customer_name || lead.customer_email}</p>
                  <p className="text-xs text-muted-foreground">{lead.customer_email}</p>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{lead.items_summary || "Sem itens"}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatBRL(lead.total)} · última atividade {formatDate(lead.last_activity)}
                    {lead.reminder_sent_date ? ` · último lembrete ${formatDate(lead.reminder_sent_date)}` : ""}
                    {lead.recovered_order ? ` · ${lead.recovered_order}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                  {view === "pendentes" && <div className="flex gap-2">
                    <Button size="sm" onClick={() => send(lead)} disabled={sending === lead.id} className="gap-1.5">
                      {sending === lead.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      Enviar lembrete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => discard(lead)}>Descartar</Button>
                  </div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {leadsQuery.hasNextPage && <Button variant="outline" onClick={() => leadsQuery.fetchNextPage()} disabled={leadsQuery.isFetching}>
        {leadsQuery.isFetchingNextPage ? "Carregando…" : "Carregar mais carrinhos"}
      </Button>}
    </div>
  );
}