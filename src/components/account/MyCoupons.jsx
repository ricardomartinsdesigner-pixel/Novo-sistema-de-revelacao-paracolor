import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CampaignTerms } from "@/components/site/CampaignNotice";
import { getMyCoupons } from "@/lib/campaign-fns";
import { CAMPAIGN_AREAS } from "@/lib/coupon-rules";
import { useCart } from "@/lib/cart";

export default function MyCoupons({ userId }) {
  const { chooseCoupon, items, ready } = useCart();
  const { data = [] } = useQuery({
    queryKey: ["my-coupons", userId],
    queryFn: () => getMyCoupons(),
    refetchInterval: 60_000,
  });
  if (!data.length) return null;
  return <section className="rounded-[1.25rem] border border-gold/50 bg-card p-6">
    <h2 className="text-lg">Meus cupons</h2>
    <ul className="mt-3 space-y-4">
      {data.map((offer) => <li key={offer.id} className="rounded-lg border border-border p-3">
        <p className="text-sm font-medium">{offer.title} · {offer.code}</p>
        <p className="mt-1 text-xs text-muted-foreground"><CampaignTerms offer={offer} /></p>
        {ready && <Button asChild size="sm" className="mt-3">
          <Link to={items.length ? "/carrinho" : CAMPAIGN_AREAS[offer.area]?.href || "/revelacao"}
            onClick={() => chooseCoupon(offer.code, userId)}>Usar cupom</Link>
        </Button>}
      </li>)}
    </ul>
  </section>;
}
