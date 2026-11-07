import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuantityPricingPanel from "@/components/admin/QuantityPricingPanel";

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
        </TabsList>
        <TabsContent value="revelacao" className="mt-6">
          <QuantityPricingPanel category="revelacao" entity="PhotoSize" />
        </TabsContent>
        <TabsContent value="polaroid" className="mt-6">
          <QuantityPricingPanel category="polaroid" entity="PolaroidModel" />
        </TabsContent>
      </Tabs>
    </div>
  );
}