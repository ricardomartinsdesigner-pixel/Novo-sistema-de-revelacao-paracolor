import { MessageCircle } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { useSettings } from "@/lib/store";

function whatsappUrl(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}` : "";
}

// Atalho de conversa sempre à vista: quem tem dúvida no meio da compra fala
// com a loja sem procurar o contato no rodapé.
export default function WhatsAppFloat() {
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const url = whatsappUrl(settings?.whatsapp);
  if (!url || pathname.startsWith("/admin")) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar com a loja no WhatsApp"
      className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 sm:h-14 sm:w-14"
    >
      <MessageCircle className="h-6 w-6" strokeWidth={1.8} />
    </a>
  );
}