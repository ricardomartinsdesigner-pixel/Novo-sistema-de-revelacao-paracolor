import { Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown when the store turned this page off in the panel: clear, never broken. */
export default function ModuleUnavailable({ title }) {
  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow">Página indisponível</p>
      <h1 className="mt-3 max-w-lg text-3xl leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        Esta página está desativada no momento. Você pode voltar para a loja ou falar com a nossa equipe para saber mais.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline" className="gap-2 rounded-full">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Voltar para a loja
          </Link>
        </Button>
        <Button asChild className="gap-2 rounded-full">
          <Link to="/contato">
            <MessageCircle className="h-4 w-4" /> Falar com a equipe
          </Link>
        </Button>
      </div>
    </div>
  );
}