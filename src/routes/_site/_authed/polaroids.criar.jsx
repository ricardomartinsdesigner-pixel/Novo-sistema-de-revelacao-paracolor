import { createFileRoute } from "@tanstack/react-router";
import PhotoStudio from "@/components/studio/PhotoStudio";

export const Route = createFileRoute("/_site/_authed/polaroids/criar")({
  head: () => ({
    meta: [
      { title: "Criar polaroids — Paracolor" },
      { name: "description", content: "Monte polaroids com moldura branca e legenda escrita direto na prévia." },
    ],
  }),
  component: () => <PhotoStudio mode="polaroid" />,
});