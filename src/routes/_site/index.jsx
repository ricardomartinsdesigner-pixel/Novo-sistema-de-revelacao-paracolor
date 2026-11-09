import { createFileRoute } from "@tanstack/react-router";
import Hero from "@/components/home/Hero";
import StudioPromo from "@/components/home/StudioPromo";
import TrustBar from "@/components/home/TrustBar";
import PromoCarousel from "@/components/site/PromoCarousel";
import AreasGrid from "@/components/home/AreasGrid";
import QuantityPricing from "@/components/home/QuantityPricing";
import HowItWorks from "@/components/home/HowItWorks";
import Advantages from "@/components/home/Advantages";
import Featured from "@/components/home/Featured";
import Gallery from "@/components/home/Gallery";
import Testimonials from "@/components/home/Testimonials";
import Faq from "@/components/home/Faq";
import HomeCta from "@/components/home/HomeCta";

export const Route = createFileRoute("/_site/")({
  head: () => ({
    meta: [
      { title: "Paracolor — Revelação de fotos, polaroids e banners" },
      {
        name: "description",
        content:
          "Revele suas fotos com qualidade de laboratório, crie polaroids com legenda e imprima banners. Envie do celular, ajuste o corte e retire na loja.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <HowItWorks />
      <Advantages />
      <AreasGrid />
      <div className="container-x">
        <PromoCarousel placement="home" />
      </div>
      <QuantityPricing />
      <Featured />
      <Gallery />
      <Testimonials />
      <StudioPromo />
      <HomeCta />
      <div id="duvidas">
        <Faq />
      </div>
    </>
  );
}
