const LEVELS = [
  { dot: "bg-emerald-600", label: "Excelente", help: "300 dpi ou mais: imprime com todo o detalhe" },
  { dot: "bg-emerald-500", label: "Adequada", help: "entre 200 e 300 dpi: ótima para ver de perto" },
  { dot: "bg-amber-500", label: "Baixa", help: "entre 150 e 200 dpi: pode ficar suave" },
  { dot: "bg-red-600", label: "Insuficiente", help: "abaixo de 150 dpi: escolha um formato menor" },
];

// O que cada cor quer dizer — sem isso o cliente não sabe o que fazer com o aviso.
export default function QualityLegend() {
  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Qualidade de impressão</p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {LEVELS.map((level) => (
          <li key={level.label} className="flex items-start gap-2 text-[11px] leading-snug text-muted-foreground">
            <span className={`mt-1 h-1.5 w-1.5 flex-none rounded-full ${level.dot}`} />
            <span>
              <strong className="font-medium text-foreground">{level.label}</strong> — {level.help}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}