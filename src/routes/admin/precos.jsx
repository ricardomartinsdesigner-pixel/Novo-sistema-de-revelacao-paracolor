import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuantityPricingPanel from "@/components/admin/QuantityPricingPanel";
import ProfessionalPricingPanel from "@/components/admin/ProfessionalPricingPanel";
import PhotoOrderCalculator from "@/components/pricing/PhotoOrderCalculator";

export const Route = createFileRoute("/admin/precos")({
  head: () => ({ meta: [{ title: "Preços e descontos — Paracolor" }] }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Preços</p>
        <h1 className="mt-1 text-3xl">Preços e descontos por quantidade</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Revelação e polaroides têm tabelas independentes. O preço unitário muda conforme a quantidade total de fotos
          do grupo, e o pedido guarda o valor efetivamente cobrado.
        </p>
      </div>

      <Tabs defaultValue="revelacao">
        <TabsList>
          <TabsTrigger value="revelacao">Revelação</TabsTrigger>
          <TabsTrigger value="polaroid">Polaroides</TabsTrigger>
          <TabsTrigger value="magnet">Ímãs de foto</TabsTrigger>
          <TabsTrigger value="calculadora">Calculadora de pedidos</TabsTrigger>
        </TabsList>
        <TabsContent value="revelacao" className="mt-6">
          <Tabs defaultValue="normal">
            <TabsList className="flex h-auto w-fit flex-wrap justify-start">
              <TabsTrigger value="normal">Tabela normal</TabsTrigger>
              <TabsTrigger value="profissional">Tabela profissional</TabsTrigger>
            </TabsList>
            <TabsContent value="normal" className="mt-4">
              <QuantityPricingPanel category="revelacao" entity="PhotoSize" />
            </TabsContent>
            <TabsContent value="profissional" className="mt-4">
              <ProfessionalPricingPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="polaroid" className="mt-6">
          <QuantityPricingPanel category="polaroid" entity="PolaroidModel" />
        </TabsContent>
        <TabsContent value="magnet" className="mt-6">
          <QuantityPricingPanel category="magnet" entity="MagnetProduct" />
        </TabsContent>
        <TabsContent value="calculadora" className="mt-6">
          <PhotoOrderCalculator mode="admin" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
