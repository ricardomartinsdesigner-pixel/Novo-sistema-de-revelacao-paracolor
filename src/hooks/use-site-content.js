import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AREAS } from "@/lib/areas";
import { CONTENT_DEFAULTS, updatedContentValue } from "@/lib/site-content";

/** Every editable text/image of the site, with the shipped copy as fallback. */
export function useSiteContent() {
  const { data } = useQuery({
    queryKey: ["site-content"],
    queryFn: async () => {
      const result = await base44.entities.SiteContent.list({ limit: 500 });
      const items = Array.isArray(result) ? result : result?.items ?? [];
      const map = {};
      for (const item of items) {
        if (item?.key && typeof item.value === "string" && item.value.trim()) map[item.key] = updatedContentValue(item.key, item.value);
      }
      return map;
    },
    staleTime: 60_000,
  });

  const content = { ...CONTENT_DEFAULTS, ...(data || {}) };
  return { content, get: (key) => content[key] || "" };
}

/** Store areas (revelação, polaroids…) with the names, texts and photos edited in the panel. */
export function useAreas() {
  const { content } = useSiteContent();
  return AREAS.map((area) => ({
    ...area,
    label: content[`area.${area.key}.label`] || area.label,
    tagline: content[`area.${area.key}.tagline`] || area.tagline,
    cta: content[`area.${area.key}.cta`] || area.cta,
    image: content[`area.${area.key}.image`] || area.image,
  }));
}