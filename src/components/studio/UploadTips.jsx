import { Check } from "lucide-react";

const TIPS = [
  "Use os arquivos originais da câmera ou do celular, não prints de tela.",
  "No iPhone, envie o HEIC direto: a conversão é automática.",
  "Fotos escuras ou tremidas não têm correção na revelação — escolha as melhores.",
  "Você pode enviar em várias rodadas: o envio continua de onde parou.",
];

// Checklist curto antes do envio: evita a maior parte das fotos que voltam como reclamação.
export default function UploadTips() {
  return (
    <div className="mt-4 rounded-[1.25rem] border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Antes de enviar</p>
      <ul className="mt-2 space-y-1.5">
        {TIPS.map((tip) => (
          <li key={tip} className="flex items-start gap-2 text-xs leading-snug text-foreground/80">
            <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-gold-deep" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}