import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import ToolsGrid from "@/components/tools/ToolsGrid";
import PhotoOrderCalculator from "@/components/pricing/PhotoOrderCalculator";
import PolaroidBatchMounter from "@/components/tools/PolaroidBatchMounter";
import PickupQrSettings from "@/components/admin/PickupQrSettings";
import StickerQuoteSettings from "@/components/admin/StickerQuoteSettings";

export const Route = createFileRoute("/admin/ferramentas")({
  head: () => ({ meta: [{ title: "Ferramentas — Paracolor" }] }),
  component: ToolsPage,
});

function ToolsPage() {
  return (
    <div>
      <p className="eyebrow">Sistema</p>
      <h1 className="mt-1 text-3xl">Ferramentas</h1>
      <p className="mb-6 mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Calcule o orçamento combinado de Revelação e Polaroides e acesse as demais ferramentas da loja.
      </p>
      <section className="card-glass mb-6 p-5">
        <div className="mb-4">
          <p className="eyebrow">Atendimento</p>
          <h2 className="mt-1 text-2xl">Calculadora de pedido</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use os formatos mistos para preparar o valor e copiar o orçamento para o cliente.</p>
        </div>
        <PhotoOrderCalculator mode="admin" />
      </section>
      <section className="mb-6 space-y-3">
        <div>
          <p className="eyebrow">Produção</p>
          <p className="mt-1 text-sm text-muted-foreground">Uso interno da equipe. Para liberar a ferramenta aos clientes, ative a opção correspondente em Módulos.</p>
        </div>
        <PolaroidBatchMounter />
      </section>
      <section className="mb-6 space-y-3">
        <div>
          <p className="eyebrow">Retiradas</p>
          <p className="mt-1 text-sm text-muted-foreground">Configure como a leitura do QR Code altera o pedido.</p>
        </div>
        <PickupQrSettings />
      </section>
      <section className="mb-6">
        <StickerQuoteSettings />
      </section>
      <ToolsGrid isAdmin />
    </div>
  );
}
