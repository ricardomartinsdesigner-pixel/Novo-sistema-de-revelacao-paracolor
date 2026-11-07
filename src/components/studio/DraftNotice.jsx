import { History, X } from "lucide-react";

// Ajustes que ficaram salvos no navegador e voltam sozinhos ao reenviar os mesmos arquivos.
export default function DraftNotice({ count, onClear }) {
  if (!count) return null;
  return (
    <div className="mt-4 flex items-start gap-3 rounded-[1.25rem] border border-gold/40 bg-gold-soft/40 p-3.5">
      <History className="mt-0.5 h-4 w-4 flex-none text-gold-deep" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground">
          Você tem ajustes salvos de um envio anterior ({count} foto{count > 1 ? "s" : ""}).
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          Reenvie as mesmas fotos e formato, corte, borda, cópias e legenda voltam como estavam.
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="Apagar ajustes salvos"
        className="flex-none rounded-full p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}