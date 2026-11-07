import { useEffect } from "react";
import { useSiteContent } from "@/hooks/use-site-content";

/** Applies the favicon chosen in the admin panel. */
export default function SiteFavicon() {
  const { content } = useSiteContent();
  const href = content["brand.favicon"];

  useEffect(() => {
    if (!href) return;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [href]);

  return null;
}