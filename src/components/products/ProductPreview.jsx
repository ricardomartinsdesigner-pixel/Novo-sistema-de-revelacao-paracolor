import { FileText, ImagePlus } from "lucide-react";
import { Image } from "@/components/ui/image";

export default function ProductPreview({ product, photos, textFields, texts }) {
  const fields = (product.photo_fields?.length ? product.photo_fields : [{ label: "Foto" }]).slice(0, 4);
  const slots = fields.map((field, index) => ({ field, photo: photos[index] }));
  const uploaded = slots.filter((slot) => slot.photo);
  const lines = textFields
    .map((field) => ({ label: field.label, value: (texts[field.label] || "").trim() }))
    .filter((line) => line.value);

  return (
    <div className="rounded-[1.25rem] border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Prévia da personalização</p>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Aproximada</span>
      </div>

      <div className="relative mt-3 aspect-[4/5] overflow-hidden rounded-xl bg-secondary">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            fittingType="fill"
          />
        ) : null}

        <div className="absolute inset-0 flex flex-col justify-center gap-3 p-5">
          {uploaded.length ? (
            <div className={uploaded.length === 1 ? "grid gap-2" : "grid grid-cols-2 gap-2"}>
              {uploaded.map((slot, index) => (
                <div
                  key={`${slot.field.label}-${index}`}
                  className={`paper overflow-hidden rounded-sm bg-card ${uploaded.length === 1 ? "mx-auto w-3/5" : "aspect-square"}`}
                >
                  {slot.photo.kind === "pdf" ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-secondary/50 px-2 text-center">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[10px] leading-tight text-muted-foreground">PDF</span>
                    </div>
                  ) : (
                    <img
                      src={slot.photo.preview}
                      alt={slot.field.label}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mx-auto flex w-3/5 flex-col items-center gap-2 rounded-sm border border-dashed border-foreground/25 bg-background/60 px-4 py-8 text-center backdrop-blur-sm">
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
              <span className="text-[11px] leading-tight text-muted-foreground">
                {slots.length > 1 ? `Envie as ${slots.length} fotos` : "Sua foto aqui"}
              </span>
            </div>
          )}

          {lines.length ? (
            <div className="mx-auto w-full max-w-[92%] rounded-md bg-background/85 px-3 py-2 text-center backdrop-blur-sm">
              {lines.map((line) => (
                <p key={line.label} className="truncate font-display text-[15px] leading-snug text-foreground">
                  {line.value}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {slots.length > 1 ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {uploaded.length} de {slots.length} fotos enviadas
        </p>
      ) : null}
    </div>
  );
}