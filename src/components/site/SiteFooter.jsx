import { Link } from "@tanstack/react-router";
import { Clock, Instagram, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import ToolsDialog from "@/components/site/ToolsDialog";
import { moduleEnabled, useSettings } from "@/lib/store";
import { useAreas, useSiteContent } from "@/hooks/use-site-content";
import { instagramHandle, instagramUrl, telHref, whatsappUrl } from "@/lib/contact";
import { publicPageEnabled } from "@/lib/public-pages";
import { Image } from "@/components/ui/image";

const HELP_LINKS = [
  { label: "Minha conta", to: "/minha-conta", setting: "page_minha_conta" },
  { label: "Meus pedidos", to: "/minha-conta", setting: "page_minha_conta" },
  { label: "Consultar pedido", to: "/consultar-pedido", setting: "page_consultar_pedido" },
  { label: "Calcular meu pedido", to: "/simulador", setting: "page_simulador" },
  { label: "Contato", to: "/contato", setting: "page_contato" },
  { label: "Perguntas frequentes", to: "/#duvidas", setting: "page_home" },
];

const LEGAL_LINKS = [
  { label: "Política de privacidade", to: "/privacidade", setting: "page_privacidade" },
  { label: "Termos de uso", to: "/termos", setting: "page_termos" },
  { label: "Entrega, troca e cancelamento", to: "/trocas", setting: "page_trocas" },
];

const COLUMN_TITLE = "text-[11px] uppercase tracking-[0.24em] text-gold";

export default function SiteFooter({ onInstallApp }) {
  const { settings } = useSettings();
  const { content } = useSiteContent();
  const allAreas = useAreas();
  const storeName = settings?.store_name || "Paracolor";
  const instagram = instagramUrl(settings?.instagram);
  const handle = instagramHandle(settings?.instagram);
  const email = (settings?.email || "").trim();
  const whatsapp = whatsappUrl(settings?.whatsapp);
  const phone = telHref(settings?.phone);
  const hours = String(settings?.hours || "").trim();
  const helpLinks = HELP_LINKS.filter((link) => publicPageEnabled(settings, link.setting));
  const legalLinks = LEGAL_LINKS.filter((link) => publicPageEnabled(settings, link.setting));
  const shopLinks = allAreas
    .filter((area) => moduleEnabled(settings, area.key))
    .map((area) => ({ label: area.label, to: area.path }));
  if (moduleEnabled(settings, "servicos")) shopLinks.push({ label: content["nav.servicos"], to: "/servicos" });
  if (moduleEnabled(settings, "estudio")) {
    shopLinks.push({ label: content["nav.estudio"], to: "/estudio-fotografico" });
  }

  return (
    <footer className="ink-panel relative border-t border-gold/30 text-ink-foreground">
      <div className="gold-rule pointer-events-none absolute inset-x-0 top-0" />
      <div className="container-x grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="inline-flex max-w-full items-center" aria-label={storeName}>
            <Image src="/brand/paracolor-logo.png" alt={storeName} className="h-auto w-[220px] max-w-full object-contain" fittingType="fit" />
          </Link>
          <p className="mt-1 h-px w-12 bg-gold" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-foreground/65">{content["brand.footer_text"]}</p>
          <ul className="mt-5 space-y-2.5 text-sm text-ink-foreground/70">
            {settings?.address ? (
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.6} aria-hidden="true" />
                <span className="leading-relaxed">{settings.address}</span>
              </li>
            ) : null}
            {phone ? (
              <li className="flex gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.6} aria-hidden="true" />
                <a href={phone} className="underline-offset-4 transition hover:text-gold hover:underline">
                  {settings.phone}
                </a>
              </li>
            ) : null}
            {hours ? (
              <li className="flex gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.6} aria-hidden="true" />
                <span className="whitespace-pre-line leading-relaxed">{hours}</span>
              </li>
            ) : null}
            {instagram ? (
              <li className="flex gap-2.5">
                <Instagram className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.6} aria-hidden="true" />
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Instagram da ${storeName} — ${handle}`}
                  className="transition hover:text-gold"
                >
                  {handle}
                </a>
              </li>
            ) : null}
          </ul>
          <div className="mt-5 flex gap-3">
            {email ? (
              <a
                href={`mailto:${email}`}
                aria-label={`Enviar e-mail para a ${storeName}`}
                className="rounded-full border border-ink-foreground/35 p-2 text-ink-foreground/70 transition hover:border-gold hover:text-gold"
              >
                <Mail className="h-4 w-4" />
              </a>
            ) : null}
            {publicPageEnabled(settings, "page_contato") ? <Link
              to="/contato"
              aria-label={`Falar com a ${storeName}`}
              className="rounded-full border border-ink-foreground/35 p-2 text-ink-foreground/70 transition hover:border-gold hover:text-gold"
            >
              <MessageCircle className="h-4 w-4" />
            </Link> : null}
          </div>
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-xs text-ink-foreground/55 transition hover:text-gold"
            >
              WhatsApp {settings.whatsapp}
            </a>
          ) : null}
        </div>

        <div>
          <p className={COLUMN_TITLE}>Loja</p>
          <ul className="mt-4 space-y-3 text-sm text-ink-foreground/70">
            {shopLinks.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className="transition hover:text-gold">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className={COLUMN_TITLE}>Ajuda</p>
          <ul className="mt-4 space-y-3 text-sm text-ink-foreground/70">
            {helpLinks.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className="transition hover:text-gold">
                  {link.label}
                </Link>
              </li>
            ))}
            <li><ToolsDialog /></li>
            {onInstallApp && <li>
              <button type="button" onClick={onInstallApp} className="text-left transition hover:text-gold">
                Instalar aplicativo
              </button>
            </li>}
          </ul>
        </div>

        <div>
          <p className={COLUMN_TITLE}>Institucional</p>
          <ul className="mt-4 space-y-3 text-sm text-ink-foreground/70">
            {legalLinks.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className="transition hover:text-gold">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-foreground/10">
        <div className="container-x flex flex-col gap-3 py-6 text-xs text-ink-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {storeName}. Todos os direitos reservados.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p>Pagamento seguro · Dados protegidos conforme a LGPD</p>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-foreground/30 px-3 py-1.5 transition hover:border-gold hover:text-gold"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Área do administrador
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
