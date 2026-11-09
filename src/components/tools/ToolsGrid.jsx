import { useState } from "react";
import { Calculator, Download, Files, Images, QrCode } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import HeicBatchTool from "@/components/tools/HeicBatchTool";
import ImageQualityTool from "@/components/tools/ImageQualityTool";
import ImagesToPdfTool from "@/components/tools/ImagesToPdfTool";
import PdfMergeTool from "@/components/tools/PdfMergeTool";
import StickerCalculatorTool from "@/components/tools/StickerCalculatorTool";
import PhotoDuplicateOrganizerTool from "@/components/tools/PhotoDuplicateOrganizerTool";
import { publicPageEnabled } from "@/lib/public-pages";
import { useSettings } from "@/lib/store";

function QrCodeTool() {
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate(event) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const { default: QRCode } = await import("qrcode");
      setImage(await QRCode.toDataURL(text.trim(), { width: 640, margin: 4, errorCorrectionLevel: "M" }));
    } catch {
      setError("Não foi possível gerar o QR Code. Tente um texto mais curto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={generate} className="card-glass p-5">
      <p className="flex items-center gap-2 text-sm font-medium"><QrCode className="h-4 w-4 text-gold-deep" /> Gerador de QR Code</p>
      <label className="mt-3 block text-xs text-muted-foreground">
        Link, WhatsApp ou texto
        <input
          value={text}
          onChange={(event) => { setText(event.target.value); setImage(""); setError(""); }}
          maxLength={1000}
          disabled={busy}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>
      <Button type="submit" size="sm" className="mt-3" disabled={busy || !text.trim()}>
        {busy ? "Gerando…" : "Gerar QR Code"}
      </Button>
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
      {image && (
        <>
          <div className="mt-3 flex justify-center rounded-lg bg-secondary/60 p-3">
            <img src={image} alt="QR Code gerado" className="h-40 w-40" />
          </div>
          <Button asChild variant="outline" size="sm" className="mt-3 w-full gap-1.5">
            <a href={image} download="paracolor-qr-code.png"><Download className="h-3.5 w-3.5" /> Baixar QR Code</a>
          </Button>
        </>
      )}
    </form>
  );
}

function ToolSection({ icon: Icon, title, description, children }) {
  return (
    <section aria-labelledby={`tools-${title.toLowerCase().replaceAll(" ", "-")}`} className="space-y-3">
      <div className="flex items-start gap-3 border-b border-border/70 pb-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-soft/55 text-gold-deep">
          <Icon className="h-4 w-4" strokeWidth={1.7} />
        </span>
        <div>
          <h3 id={`tools-${title.toLowerCase().replaceAll(" ", "-")}`} className="font-body text-base font-semibold tracking-normal">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-2 sm:gap-4">{children}</div>
    </section>
  );
}

export default function ToolsGrid({ onNavigate }) {
  const { settings } = useSettings();
  const showPolaroidMounter = publicPageEnabled(settings, "module_polaroid_batch_mounter");
  const showOrderCalculator = publicPageEnabled(settings, "page_simulador");

  return (
    <div className="space-y-7 pb-2">
      <ToolSection icon={Files} title="Arquivos e PDFs" description="Converta fotos e prepare seus documentos para enviar ou guardar.">
        <HeicBatchTool />
        <ImagesToPdfTool />
        <PdfMergeTool />
        <QrCodeTool />
      </ToolSection>

      <ToolSection icon={Images} title="Fotos e impressão" description="Confira a qualidade, organize imagens e prepare materiais para impressão.">
        <ImageQualityTool />
        <PhotoDuplicateOrganizerTool onNavigate={onNavigate} />
        <StickerCalculatorTool />
        {showPolaroidMounter && (
          <Link
            to="/montador-polaroides"
            onClick={onNavigate}
            className="card-glass rounded-xl border border-border p-5 font-body transition hover:border-gold"
          >
            <p className="flex items-center gap-2 text-sm font-medium"><Images className="h-4 w-4 text-gold-deep" /> Montador de Polaroides em lote</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Envie fotos, escolha Baby, Mini ou Normal e baixe as montagens prontas em ZIP.</p>
            <span className="mt-3 inline-flex items-center text-xs font-medium text-primary">Abrir montador →</span>
          </Link>
        )}
      </ToolSection>

      {showOrderCalculator && (
        <ToolSection icon={Calculator} title="Pedidos e orçamento" description="Consulte rapidamente o valor estimado de um pedido misto.">
          <Link
            to="/simulador"
            onClick={onNavigate}
            className="card-glass rounded-xl border border-border p-5 font-body transition hover:border-gold"
          >
            <p className="flex items-center gap-2 text-sm font-medium"><Calculator className="h-4 w-4 text-gold-deep" /> Calculadora de pedido</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Informe as quantidades de fotos e Polaroides para consultar a faixa de preço e o valor estimado.</p>
            <span className="mt-3 inline-flex items-center text-xs font-medium text-primary">Abrir calculadora →</span>
          </Link>
        </ToolSection>
      )}
    </div>
  );
}
