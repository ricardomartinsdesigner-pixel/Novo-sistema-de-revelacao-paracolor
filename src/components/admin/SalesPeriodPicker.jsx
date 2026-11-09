export default function SalesPeriodPicker({ days, onChange }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Período dos pedidos">
      {[7, 30, 90].map((range) => (
        <button
          type="button"
          key={range}
          aria-pressed={days === range}
          onClick={() => onChange(range)}
          className={`rounded-full border px-3 py-1.5 text-xs transition ${days === range ? "border-primary bg-accent text-primary" : "border-border hover:bg-secondary"}`}
        >
          {range} dias
        </button>
      ))}
    </div>
  );
}
