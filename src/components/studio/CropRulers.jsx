// Réguas da impressão: cada traço vale 1 cm do papel e o traço maior marca 5 cm.
function RulerTicks({ total, vertical = false }) {
  const marks = [];
  for (let cm = 0; cm <= Math.floor(total); cm += 1) marks.push(cm);

  return marks.map((cm) => {
    const major = cm % 5 === 0;
    return (
      <span
        key={cm}
        className={`absolute bg-gold-deep/40 ${major ? (vertical ? "h-[0.5px] w-2" : "h-2 w-[0.5px]") : vertical ? "h-[0.5px] w-1" : "h-1 w-[0.5px]"}`}
        style={vertical ? { top: `${(cm / total) * 100}%`, right: 0 } : { left: `${(cm / total) * 100}%`, bottom: 0 }}
      />
    );
  });
}

export default function CropRulers({ box, wCm, hCm }) {
  const width = Number(wCm) || 0;
  const height = Number(hCm) || 0;
  if (!width || !height) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute left-1/2 top-1/2 border-b-[0.5px] border-gold-deep/25"
        style={{ width: box.w, height: 12, marginLeft: -box.w / 2, marginTop: -box.h / 2 - 18 }}
      >
        <RulerTicks total={width} />
      </div>

      <div
        className="absolute left-1/2 top-1/2 border-r-[0.5px] border-gold-deep/25"
        style={{ height: box.h, width: 12, marginLeft: -box.w / 2 - 18, marginTop: -box.h / 2 }}
      >
        <RulerTicks total={height} vertical />
      </div>
    </div>
  );
}