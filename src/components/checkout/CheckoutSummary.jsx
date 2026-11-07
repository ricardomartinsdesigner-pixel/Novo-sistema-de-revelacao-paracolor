import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import CheckoutField from "@/components/checkout/CheckoutField";
import { formatBRL } from "@/lib/areas";
import { formatReadyDate } from "@/lib/deadline";

export default function CheckoutSummary({ quote, calculating, coupon, setCoupon, submitting, error, readyDate }) {
  return <aside className="h-fit rounded-[1.25rem] border border-border bg-card p-6">
    <h2 className="text-xl">Resumo</h2>
    <div aria-live="polite" className="mt-4">
      {calculating ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Conferindo valores…</p> : quote && <>
        <ul className="space-y-2 text-sm">{quote.items.map((item, index) => <li key={index} className="flex justify-between gap-3"><span className="text-muted-foreground">{item.product_name} · {item.qty} un</span><span>{formatBRL(item.line_total)}</span></li>)}</ul>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBRL(quote.subtotal)}</dd></div>
          {quote.discount > 0 && <div className="flex justify-between"><dt>Desconto ({quote.coupon_code})</dt><dd>-{formatBRL(quote.discount)}</dd></div>}
          <div className="flex justify-between"><dt>Frete</dt><dd>{formatBRL(quote.shipping_cost)}</dd></div>
          <div className="flex justify-between border-t border-border pt-4 font-medium"><dt>Total</dt><dd>{formatBRL(quote.total)}</dd></div>
        </dl>
      </>}
    </div>
    <div className="mt-4"><CheckoutField label="Cupom de desconto" value={coupon} onChange={setCoupon} /><p className="mt-1 text-[11px] text-muted-foreground">O desconto aparece no total após a conferência.</p></div>
    {readyDate ? <p className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">Previsão de pronto: <strong className="text-foreground">{formatReadyDate(readyDate)}</strong> (considerando horário de produção e feriados)</p> : null}
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    <Button type="submit" size="lg" disabled={submitting || calculating || !quote} className="mt-5 w-full rounded-full">
      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}{submitting ? "Registrando pedido…" : "Concluir pedido"}
    </Button>
    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Valores conferidos antes da confirmação. A produção começa somente após o pagamento confirmado e a aprovação da arte, quando necessária.</p>
  </aside>;
}
