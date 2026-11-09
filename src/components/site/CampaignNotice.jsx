import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getPublicCampaigns } from "@/lib/campaign-fns";
import { CAMPAIGN_AREAS, campaignWindow } from "@/lib/coupon-rules";
import { formatBRL, formatDate } from "@/lib/areas";
import { useCart } from "@/lib/cart";

export function CampaignTerms({ offer }) {
  const { ends } = campaignWindow(offer);
  const terms = [
    offer.type === "percent" ? offer.value + "% de desconto" : formatBRL(offer.value) + " de desconto",
    offer.product_name || CAMPAIGN_AREAS[offer.area]?.label,
    offer.min_quantity ? "A partir de " + offer.min_quantity + " unidades elegíveis" : "",
    offer.min_total ? "Mínimo de " + formatBRL(offer.min_total) + " em itens elegíveis" : "",
    offer.max_discount ? "Desconto de até " + formatBRL(offer.max_discount) : "",
    Number.isFinite(ends) ? "Até " + formatDate(ends) : "",
  ].filter(Boolean);
  return <span>{terms.join(" · ")}</span>;
}

function OfferButton({ offer }) {
  const { chooseCoupon, items, ready } = useCart();
  const path = offer.code && items.length ? "/carrinho" : CAMPAIGN_AREAS[offer.area]?.href || "/revelacao";
  if (!ready) return null;
  return <Button size="sm" asChild className="shrink-0">
    <Link to={path} onClick={() => { if (offer.code) chooseCoupon(offer.code); }}>{offer.code ? "Usar cupom" : "Ver oferta"}</Link>
  </Button>;
}

export default function CampaignNotice({ onPopupBusyChange, pausePopup }) {
  const { data: campaigns, isPending } = useQuery({ queryKey: ["public-campaigns"], queryFn: () => getPublicCampaigns(), refetchInterval: 30_000 });
  const data = campaigns?.offers;
  const [popupId, setPopupId] = useState(null);
  const [presented, setPresented] = useState(false);
  const banner = data?.find((offer) => offer.notice === "banner");
  const popup = data?.find((offer) => offer.id === popupId && offer.notice === "popup");

  useEffect(() => {
    if (popup || isPending) {
      onPopupBusyChange(true);
      return undefined;
    }
    const next = !pausePopup && !presented && data?.find((offer) => {
      if (offer.notice !== "popup") return false;
      try { return !localStorage.getItem("paracolor.campaign.seen." + offer.id); }
      catch { return true; }
    });
    onPopupBusyChange(Boolean(next));
    if (!next) return undefined;
    const timer = setTimeout(() => {
      try { localStorage.setItem("paracolor.campaign.seen." + next.id, "1"); } catch { /* still show this visit */ }
      setPresented(true);
      setPopupId(next.id);
    }, 400);
    return () => clearTimeout(timer);
  }, [data, isPending, onPopupBusyChange, pausePopup, popup, presented]);

  return <>
    {banner && <section aria-label="Promoção da loja" className="border-b border-gold/40 bg-gold-soft/65">
      <div className="container-x flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex items-start gap-2 text-sm"><Tag className="mt-0.5 h-4 w-4 shrink-0" />
          <div><strong>{banner.title}</strong>
            <p className="text-xs">{banner.message && <>{banner.message} · </>}<CampaignTerms offer={banner} /></p>
          </div>
        </div>
        <OfferButton offer={banner} />
      </div>
    </section>}
    <Dialog open={Boolean(popup)} onOpenChange={(open) => { if (!open) setPopupId(null); }}>
      {popup && <DialogContent className="max-h-[90dvh] w-[92vw] max-w-md overflow-y-auto rounded-2xl">
        {popup.image_url && <img src={popup.image_url} alt="" className="max-h-52 w-full rounded-lg object-contain" />}
        <DialogTitle className="pr-5 text-2xl">{popup.title}</DialogTitle>
        <DialogDescription>
          {popup.message && <span className="mb-2 block">{popup.message}</span>}
          <CampaignTerms offer={popup} />
          {popup.code && <strong className="mt-2 block">Cupom {popup.code}</strong>}
        </DialogDescription>
        <div className="flex flex-wrap gap-2">
          <OfferButton offer={popup} />
          <Button size="sm" variant="outline" onClick={() => setPopupId(null)}>Fechar aviso</Button>
        </div>
      </DialogContent>}
    </Dialog>
  </>;
}
