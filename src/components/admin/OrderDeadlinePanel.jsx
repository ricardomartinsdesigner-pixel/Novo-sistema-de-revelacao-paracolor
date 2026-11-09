import { needsArtApproval } from "@/lib/order-production";
import { useState } from "react";
import { CalendarClock, Clock, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { canProduceOrder } from "@/lib/order-payment";
import { setOrderDeadline, startQuickProduction, updateOrderStatus } from "@/lib/store-fns";
import { formatDate } from "@/lib/areas";
import OrderCountdown from "@/components/orders/OrderCountdown";

const QUICK = [
  { preset: "1h", label: "1 hora", hint: "retirada" },
  { preset: "1d", label: "1 dia", hint: "24 horas" },
  { preset: "2d", label: "2 dias", hint: "48 horas" },
];

/** Prazos do pedido: atalhos rápidos ou uma data/hora escolhida à mão. */
export default function OrderDeadlinePanel({ order, onDone }) {
  const [busy, setBusy] = useState("");
  const [custom, setCustom] = useState("");
  const unavailable = ["aguardando_conferencia", "pronto", "retirado", "enviado", "concluido", "cancelado"].includes(order.status)
    || !canProduceOrder(order) || needsArtApproval(order);

  async function run(key, task, message) {
    setBusy(key);
    try {
      await task();
      toast.success(message);
      await onDone();
    } catch (error) {
      toast.error(error?.message || "Não foi possível aplicar a ação.");
    } finally {
      setBusy("");
    }
  }

  function applyCustom() {
    if (!custom) {
      toast.warning("Escolha a data e a hora do prazo.");
      return;
    }
    const iso = new Date(custom).toISOString();
    run("custom", () => setOrderDeadline({ data: { order_id: order.id, due_at: iso } }), "Prazo definido");
  }

  return (
    <section className="card-glass p-5">
      <h2 className="text-lg">Atalhos de produção</h2>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Inicie a produção ou defina um prazo que o cliente pode acompanhar. A equipe confirma quando o pedido fica pronto.
      </p>

      {order.quick_due_at ? (
        <div className="mt-3 rounded-lg border border-gold/40 bg-gold-soft px-3 py-2 text-xs">
          <p>
            Prazo atual: <strong>{formatDate(order.quick_due_at)}</strong>
            {order.quick_label ? ` · ${order.quick_label}` : ""}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            Restam <OrderCountdown dueAt={order.quick_due_at} className="font-medium text-foreground" />
          </p>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        <Button type="button" size="sm" disabled={Boolean(busy) || unavailable || order.status === "em_producao"}
          onClick={() => run("start", () => updateOrderStatus({ data: { order_id: order.id, status: "em_producao" } }), "Pedido em produção")}>
          {busy === "start" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Em produção
        </Button>
        {QUICK.map((action) => (
          <Button
            key={action.preset}
            size="sm"
            variant="outline"
            onClick={() => run(action.preset, () => startQuickProduction({ data: { order_id: order.id, preset: action.preset } }), "Pedido em produção com prazo definido")}
            disabled={Boolean(busy) || unavailable}
            className="justify-between gap-2"
          >
            <span className="flex items-center gap-1.5">
              {busy === action.preset ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
              Em produção · {action.label}
            </span>
            <span className="text-[11px] text-muted-foreground">{action.hint}</span>
          </Button>
        ))}
      </div>

      <div className="mt-4 border-t border-border/60 pt-3">
        <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground" htmlFor="deadline">
          Ou escolha a data e a hora
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id="deadline"
            type="datetime-local"
            disabled={unavailable}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <Button size="sm" onClick={applyCustom} disabled={Boolean(busy) || unavailable} className="gap-1.5">
            {busy === "custom" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
            Aplicar prazo
          </Button>
        </div>
        {order.quick_due_at ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => run("clear", () => setOrderDeadline({ data: { order_id: order.id } }), "Prazo removido")}
            disabled={Boolean(busy)}
            className="mt-2 gap-1.5 text-muted-foreground"
          >
            {busy === "clear" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Remover prazo
          </Button>
        ) : null}
      </div>
    </section>
  );
}
