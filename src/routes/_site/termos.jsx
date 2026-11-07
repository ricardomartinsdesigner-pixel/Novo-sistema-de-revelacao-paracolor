import { createFileRoute } from "@tanstack/react-router";
import LegalContent from "@/components/site/LegalContent";

export const Route = createFileRoute("/_site/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Paracolor" },
      { name: "description", content: "Condições de uso do site, dos pedidos e dos serviços de impressão da Paracolor." },
    ],
  }),
  component: () => (
    <LegalContent
      title="Termos de uso"
      updated="novembro de 2026"
      sections={[
        {
          heading: "Sobre os produtos",
          paragraphs: [
            "As prévias do editor mostram exatamente o enquadramento escolhido. A impressão segue as configurações salvas no pedido.",
            "Pequenas variações de cor entre a tela e o papel são esperadas, pois monitores e impressoras têm gamas de cor diferentes.",
          ],
        },
        {
          heading: "Aprovação de arte",
          paragraphs: [
            "Quando o produto exige aprovação, a produção só começa após o registro da aprovação pela equipe da Paracolor.",
            "A aprovação é registrada manualmente pelo atendimento, após a sua confirmação pelo WhatsApp.",
          ],
        },
        {
          heading: "Responsabilidade do cliente",
          paragraphs: [
            "É responsável pelo conteúdo enviado e por garantir que possui direito de uso das imagens.",
            "Conteúdos ilegais, ofensivos ou que violem direitos de terceiros não serão produzidos.",
          ],
        },
        {
          heading: "Prazos",
          paragraphs: [
            "O prazo de produção é contado em dias úteis após a confirmação do pagamento e, quando aplicável, após a aprovação da arte.",
            "O prazo de transporte, quando contratado, é separado do prazo de produção.",
          ],
        },
      ]}
    />
  ),
});