import { Grid2x2, LayoutGrid, Search, Wand2 } from "lucide-react";

const FILTERS = [
  { value: "all", label: "Todas" },
  { value: "alerts", label: "Com corte" },
  { value: "lowres", label: "Resolução baixa" },
  { value: "errors", label: "Com erro" },
];

const ACTIVE_CHIP = "border-primary bg-primary text-primary-foreground";
const IDLE_CHIP = "border-gold/55 bg-gold-soft/40 text-foreground hover:border-gold";

export default function PhotoFilters({
  value,
  onChange,
  search,
  onSearch,
  counts = {},
  density,
  onDensity,
  cutCount = 0,
  onFixCuts,
}) {
  return (
    <div className="mt-8 rounded-[1.25rem] border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar pelo nome do arquivo"
            aria-label="Buscar foto pelo nome do arquivo"
            className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-3 text-xs outline-none focus-visible:border-gold"
          />
        </label>
        <div className="flex flex-none items-center gap-1 rounded-full border border-gold/40 p-0.5">
          <button
            type="button"
            onClick={() => onDensity("comfortable")}
            aria-pressed={density === "comfortable"}
            aria-label="Miniaturas grandes"
            className={`rounded-full p-1.5 transition ${
              density === "comfortable" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDensity("compact")}
            aria-pressed={density === "compact"}
            aria-label="Miniaturas pequenas, mais fotos por tela"
            className={`rounded-full p-1.5 transition ${
              density === "compact" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Grid2x2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((item) => {
          const count = counts[item.value] ?? 0;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              aria-pressed={value === item.value}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                value === item.value ? ACTIVE_CHIP : IDLE_CHIP
              }`}
            >
              {item.label}
              {count ? ` · ${count}` : ""}
            </button>
          );
        })}
        {cutCount > 0 && onFixCuts ? (
          <button
            type="button"
            onClick={onFixCuts}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-gold px-3 py-1 text-[11px] font-medium text-gold-deep transition hover:bg-gold-soft"
          >
            <Wand2 className="h-3.5 w-3.5" /> Corrigir {cutCount} corte(s)
          </button>
        ) : null}
      </div>
    </div>
  );
}