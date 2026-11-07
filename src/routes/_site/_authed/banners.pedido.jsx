import { createFileRoute } from "@tanstack/react-router";
import BannerConfigurator from "@/components/banners/BannerConfigurator";

export const Route = createFileRoute("/_site/_authed/banners/pedido")({
  head: () => ({ meta: [{ title: "Montar banner — Paracolor" }] }),
  component: BannerOrderPage,
});

function BannerOrderPage() {
  return (
    <div className="container-x py-12">
      <p className="eyebrow">Banners</p>
      <h1 className="mt-2 text-4xl">Monte seu banner</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Escolha o tamanho, o material e o acabamento. O preço é calculado por metro quadrado com a tabela da loja.
      </p>
      <div className="mt-8">
        <BannerConfigurator />
      </div>
    </div>
  );
}