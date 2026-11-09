import { Link } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import CheckoutField from "@/components/checkout/CheckoutField";
import { formatBRL } from "@/lib/areas";
import { formatReadyDate } from "@/lib/deadline";

export default function CheckoutSummary({ quote, calculating, coupon, setCoupon, submitting, error, itemEstimate, readyDate, paymentBlocked = false, payOnPickup = false }) {
  return <aside className="h-fit rounded-[1.25rem] border border-border bg-card p-6">
    <h2 className="text-xl">Resumo</h2>
    <div aria-live="polite" className="mt-4">
      {calculating ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Conferindo valores…</p> : quote && <>
        <ul className="space-y-2 text-sm">{quote.items.map((item, index) => (
          <li key={index} className="flex justify-between gap-3">
            <div className="text-muted-foreground">
              <span>{item.product_name} · {item.qty} un</span>
              {(item.pricing_table === "profissional" || item.tier_label) && (
                <p className="text-xs font-medium text-primary">
                  {item.pricing_table === "profissional" ? "Tabela profissional" : "Faixa de preço"}
                  {item.tier_label ? ` · ${item.tier_label}` : ""}{item.tier_quantity ? ` (${item.tier_quantity} cópias na contagem)` : ""}
                  {" · "}{formatBRL(item.unit_price)} por cópia (valor base)
                </p>
              )}
            </div>
            <span>{formatBRL(item.line_total)}</span>
          </li>
        ))}</ul>
        {Math.abs(quote.subtotal - itemEstimate) >= 0.01 && <p className="mt-3 rounded-lg bg-accent/60 p-3 text-xs">
          O subtotal foi recalculado de {formatBRL(itemEstimate)} para {formatBRL(quote.subtotal)} com os preços atuais e as faixas deste pedido. Frete e cupom aparecem separados abaixo.
        </p>}
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBRL(quote.subtotal)}</dd></div>
          {quote.discount > 0 && <div className="flex justify-between"><dt>Desconto ({quote.discount_label || quote.coupon_code})</dt><dd>-{formatBRL(quote.discount)}</dd></div>}
          <div className="flex justify-between"><dt>Frete</dt><dd>{formatBRL(quote.shipping_cost)}</dd></div>
          <div className="flex justify-between border-t border-border pt-4 font-medium"><dt>Total</dt><dd>{formatBRL(quote.total)}</dd></div>
        </dl>
      </>}
    </div>
    <div className="mt-4"><CheckoutField label="Cupom de desconto" value={coupon} onChange={setCoupon} /><p className="mt-1 text-[11px] text-muted-foreground">O desconto aparece no total após a conferência.</p></div>
    {readyDate ? <p className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">Previsão de pronto: <strong className="text-foreground">{formatReadyDate(readyDate)}</strong> (considerando horário de produção e feriados)</p> : null}
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    <Button type="submit" size="lg" disabled={submitting || calculating || !quote || paymentBlocked} className="mt-5 w-full rounded-full">
      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}{submitting ? "Registrando pedido…" : "Concluir pedido"}
    </Button>
    <nav aria-label="Informações da compra" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-primary">
      <Link to="/trocas" hash="retirada-entrega" target="_blank" rel="noopener" className="underline">Retirada e entrega</Link>
      <Link to="/trocas" hash="cancelamento" target="_blank" rel="noopener" className="underline">Cancelamento</Link>
      <Link to="/termos" target="_blank" rel="noopener" className="underline">Termos</Link>
      <Link to="/privacidade" target="_blank" rel="noopener" className="underline">Privacidade</Link>
    </nav>
    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
      {payOnPickup
        ? "Você paga no balcão ao buscar o pedido. A produção segue após a liberação da loja e a aprovação da arte, quando necessária."
        : "Valores conferidos antes da confirmação. A produção começa após o pagamento confirmado e a aprovação da arte, quando necessária."}
    </p>
  </aside>;
}
