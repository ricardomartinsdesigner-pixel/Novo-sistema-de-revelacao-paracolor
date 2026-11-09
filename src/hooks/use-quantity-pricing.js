import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/AuthContext";
import { getProfessionalPricing } from "@/lib/professional-pricing-fns";
import { useEntityList } from "@/lib/store";

export function useQuantityPricing(includeProfessional = true) {
  const { user, isLoadingAuth } = useAuth();
  const getProfessional = useServerFn(getProfessionalPricing);
  const professional = useQuery({
    queryKey: ["shop-professional-pricing", user?.id],
    enabled: includeProfessional && Boolean(user?.id),
    queryFn: () => getProfessional(),
  });
  const tiers = useEntityList("QuantityTier", { active: true }, { sort: "min_qty" });
  const tierPrices = useEntityList("TierPrice", {}, { limit: 1000 });
  const groups = useEntityList("PriceGroup", { active: true }, { sort: "sort" });
  const professionalData = includeProfessional && user?.id ? professional.data ?? null : null;
  const data = useMemo(() => ({
    tiers: tiers.data ?? [],
    tierPrices: tierPrices.data ?? [],
    groups: groups.data ?? [],
    professional: professionalData,
  }), [tiers.data, tierPrices.data, groups.data, professionalData]);

  return {
    data,
    isLoading: tiers.isLoading || tierPrices.isLoading || groups.isLoading
      || (includeProfessional && (isLoadingAuth || professional.isLoading)),
    professionalError: includeProfessional && user?.id ? professional.error : null,
    retryProfessional: professional.refetch,
  };
}
