import { useSignedUrl } from "@/lib/store";
import { formatBRL } from "@/lib/areas";

export default function OrderItemOptions({ item }) {
  const options = item.options || {};
  const art = useSignedUrl(options.art_file_uri);
  const magnetSheet = useSignedUrl(options.magnet_print_sheet_uri);
  return <div className="mt-2 space-y-1 text-xs text-muted-foreground">
    {options.pricing_table === "profissional" && (
      <p className="font-medium text-primary">
        Tabela profissional{options.tier_label ? " · " + options.tier_label : ""} · {formatBRL(item.unit_price)} por cópia
      </p>
    )}
    {Object.entries(options.text_values || {}).map(([label, value]) => value ? <p key={label}><strong>{label}:</strong> {value}</p> : null)}
    {options.magnet_kind === "strip_kit" && <p>Kit magnético · três tirinhas 5 × 20 cm{options.magnet_layout ? " · montagem personalizada" : ""}</p>}
    {magnetSheet && <a href={magnetSheet} target="_blank" rel="noreferrer" className="inline-block text-primary underline">Abrir folha pronta para impressão (15,2 × 20 cm)</a>}
    {options.instructions && <p className="whitespace-pre-wrap"><strong>Instruções:</strong> {options.instructions}</p>}
    {options.art_mode === "equipe" && <p>Criação da arte pela equipe · aprovação obrigatória</p>}
    {art && <a href={art} target="_blank" rel="noreferrer" className="inline-block text-primary underline">Abrir arte original{options.art_original_name ? `: ${options.art_original_name}` : ""}</a>}
  </div>;
}
