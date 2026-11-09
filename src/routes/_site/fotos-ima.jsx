import { createFileRoute } from "@tanstack/react-router";
import MagnetCreator from "@/components/magnets/MagnetCreator";

export const Route = createFileRoute("/_site/fotos-ima")({
  head: () => ({ meta: [
    { title: "Fotos Ímã — Paracolor" },
    { name: "description", content: "Crie tirinhas magnéticas e fotos ímã personalizadas com suas fotos." },
  ] }),
  component: MagnetCreator,
});
