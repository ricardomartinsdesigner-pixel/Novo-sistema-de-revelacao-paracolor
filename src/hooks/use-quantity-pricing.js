import { useEntityList } from "@/lib/store";

export function useQuantityPricing() {
  const tiers = useEntityList("QuantityTier", { active: true }, { sort: "min_qty" });
  const tierPrices = useEntityList("TierPrice", {}, { limit: 500 });
  const groups = useEntityList("PriceGroup", { active: true }, { sort: "sort" });

  return {
    data: {
      tiers: tiers.data ?? [],
      tierPrices: tierPrices.data ?? [],
      groups: groups.data ?? [],
    },
    isLoading: tiers.isLoading || tierPrices.isLoading || groups.isLoading,
  };
}