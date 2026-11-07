import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
};

export const Route = createFileRoute("/admin/carrinhos")({
  head: () => ({ meta: [{ title: "Carrinhos abandonados — Paracolor" }] }),
  component: CarrinhosPage,
});

function CarrinhosPage() {
  const queryClient = useQueryClient();
  const remind = useServerFn(sendCartReminder);
  const [sending, setSending] = useState("");

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["cart-leads"],
    queryFn: async () => {
      const result = await base44.entities.CartLead.filter({}, { limit: 100, sort: "-last_activity" });
      return (result.items ?? []).filter((lead) => lead.status !== "descartado");
    },
  });

  async function send(lead) {
    setSending(lead.id);
    try {
      const result = await remind({
        data: { id: lead.id, origin: typeof window === "undefined" ? "" : window.location.origin },
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
    await base44.entities.CartLead.update(lead.id, { status: "descartado" });
    await queryClient.invalidateQueries({ queryKey: ["cart-leads"] });
    toast.success("Carrinho descartado");
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
        <Button variant="outline" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando carrinhos…
        </p>
      ) : leads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
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
                    {lead.reminder_count ? ` · ${lead.reminder_count} lembrete(s)` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => send(lead)} disabled={sending === lead.id} className="gap-1.5">
                      {sending === lead.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      Enviar lembrete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => discard(lead)}>Descartar</Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}