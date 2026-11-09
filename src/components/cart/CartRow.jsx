import { FileText, ImageIcon, Trash2 } from "lucide-react";
import { useSignedUrl } from "@/lib/store";
import { formatBRL } from "@/lib/areas";
import { Image } from "@/components/ui/image";
import { cartLineTotal } from "@/lib/cart-items";

export default function CartRow({ item, onRemove, onQty }) {
  // PDF não tem prévia de imagem: o carrinho mostra o ícone do arquivo.
  const isPdf = /\.pdf$/i.test(item.photos?.[0]?.filename || item.options?.art_original_name || "");
  const previewUri = isPdf
    ? ""
    : item.options?.magnet_print_sheet_uri || item.photos?.[0]?.print_file_uri ||
      item.photos?.[0]?.original_file_uri ||
      item.options?.art_file_uri ||
      item.options?.preview_uri ||
      item.image;
  const image = useSignedUrl(previewUri);
  const isPhotoItem = item.area === "revelacao" || item.area === "polaroid" || (item.area === "magnet" && item.options?.magnet_kind !== "strip_kit");

  return (
    <div className="flex gap-4 border-b border-border/70 py-5 last:border-0">
      <div className="h-24 w-24 flex-none overflow-hidden rounded-xl bg-secondary">
        {image ? (
          <Image src={image} alt={item.title} className="h-full w-full object-contain" fittingType="fit" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            {isPdf ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
            {isPdf ? <span className="text-[10px]">PDF</span> : null}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>
            {item.photos?.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {item.area === "magnet" && item.options?.magnet_kind === "strip_kit"
                  ? `${(Number(item.qty) || 1) * 3} tirinha(s) magnética(s)`
                  : <>{item.photos.length} foto(s) · {item.photos.reduce((sum, photo) => sum + (photo.copies || 1), 0)} impressão(ões)</>}
              </p>
            )}
            {item.pricingTable === "profissional" && (
              <p className="mt-1 text-xs font-medium text-primary">
                Tabela profissional{item.tierLabel ? " · " + item.tierLabel : ""} · {formatBRL(item.tierUnitPrice)} por cópia
              </p>
            )}
            {item.options?.variation_name && (
              <p className="mt-1 text-xs text-muted-foreground">
                {item.options.variation_name}: {item.options.variation_option}
              </p>
            )}
            {item.options?.addons?.length ? (
              <p className="mt-1 text-xs text-muted-foreground">Adicionais: {item.options.addons.join(", ")}</p>
            ) : null}
            {Object.values(item.options?.text_values || {}).some((value) => String(value || "").trim()) ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Textos:{" "}
                {Object.values(item.options.text_values)
                  .map((value) => String(value || "").trim())
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.key)}
            aria-label="Remover item"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          {isPhotoItem ? (
            <span className="text-xs text-muted-foreground">Enquadramento salvo no item</span>
          ) : (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Qtd
              <input
                type="number"
                min="1"
                max="99"
                value={item.qty}
                onChange={(event) => onQty(item.key, event.target.value)}
                className="w-16 rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground"
              />
            </label>
          )}
          <span className="text-sm font-medium">
            {formatBRL(cartLineTotal(item))}
          </span>
        </div>
      </div>
    </div>
  );
}
