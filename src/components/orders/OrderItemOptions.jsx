import { useSignedUrl } from "@/lib/store";

export default function OrderItemOptions({ item }) {
  const options = item.options || {};
  const art = useSignedUrl(options.art_file_uri);
  return <div className="mt-2 space-y-1 text-xs text-muted-foreground">
    {Object.entries(options.text_values || {}).map(([label, value]) => value ? <p key={label}><strong>{label}:</strong> {value}</p> : null)}
    {options.art_mode === "equipe" && <p>Criação da arte pela equipe · aprovação obrigatória</p>}
    {art && <a href={art} target="_blank" rel="noreferrer" className="inline-block text-primary underline">Abrir arte original{options.art_original_name ? `: ${options.art_original_name}` : ""}</a>}
  </div>;
}