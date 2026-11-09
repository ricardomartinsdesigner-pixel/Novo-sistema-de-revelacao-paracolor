import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const SHOW_AFTER = 400;

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > SHOW_AFTER);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  if (!visible) return null;

  function goToTop() {
    document.getElementById("topo-da-loja")?.focus({ preventScroll: true });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
  }

  return (
    <Button type="button" variant="outline" size="icon" onClick={goToTop}
      aria-label="Voltar ao topo" title="Voltar ao topo"
      className="pointer-events-auto h-11 w-11 rounded-full shadow-lg">
      <ArrowUp aria-hidden="true" />
    </Button>
  );
}
