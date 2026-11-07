import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, QrCode, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeicBatchTool from "@/components/tools/HeicBatchTool";
import ImagesToPdfTool from "@/components/tools/ImagesToPdfTool";
import PdfMergeTool from "@/components/tools/PdfMergeTool";

export const Route = createFileRoute("/admin/ferramentas")({
  head: () => ({ meta: [{ title: "Ferramentas — Paracolor" }] }),
  component: ToolsPage,
});

function ToolsPage() {
  const [qrText, setQrText] = useState("");

  const qrUrl = qrText.trim()
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrText.trim())}`
    : "";

  return (
    <div>
      <p className="eyebrow">Sistema</p>
      <h1 className="mt-1 text-3xl">Ferramentas gratuitas</h1>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Tudo roda no seu navegador — nenhum arquivo é enviado para a nuvem.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="card-glass p-5">
          <p className="flex items-center gap-2 text-sm font-medium"><QrCode className="h-4 w-4" /> QR Code</p>
          <input
            value={qrText}
            onChange={(event) => setQrText(event.target.value)}
            placeholder="Link, WhatsApp ou texto"
            className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="mt-3 flex min-h-[160px] items-center justify-center rounded-lg bg-secondary/60 p-3">
            {qrUrl ? <img src={qrUrl} alt="QR Code gerado" className="h-40 w-40" /> : <span className="text-[11px] text-muted-foreground">Digite algo para gerar</span>}
          </div>
          {qrUrl ? (
            <Button asChild variant="outline" size="sm" className="mt-3 w-full gap-1.5">
              <a href={qrUrl} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /> Abrir para baixar</a>
            </Button>
          ) : null}
        </section>

        <HeicBatchTool />
        <ImagesToPdfTool />
        <PdfMergeTool />
      </div>
    </div>
  );
}