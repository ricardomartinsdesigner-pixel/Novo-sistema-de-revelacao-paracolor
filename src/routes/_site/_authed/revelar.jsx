import { createFileRoute } from "@tanstack/react-router";
import PhotoStudio from "@/components/studio/PhotoStudio";

export const Route = createFileRoute("/_site/_authed/revelar")({
  head: () => ({
    meta: [
      { title: "Revelar fotos — Paracolor" },
      { name: "description", content: "Envie suas fotos, escolha o formato e ajuste o enquadramento antes de imprimir." },
    ],
  }),
  component: () => <PhotoStudio mode="revelacao" />,
});