import { createFileRoute } from "@tanstack/react-router";
import LegalContent from "@/components/site/LegalContent";

export const Route = createFileRoute("/_site/trocas")({
  head: () => ({
    meta: [
      { title: "Entrega, troca e cancelamento — Paracolor" },
      { name: "description", content: "Prazos de produção, retirada na loja e regras de troca e cancelamento dos pedidos." },
    ],
  }),
  component: () => (
    <LegalContent
      title="Entrega, troca e cancelamento"
      updated="novembro de 2026"
      sections={[
        {
          id: "retirada-entrega",
          heading: "Retirada e entrega",
          paragraphs: [
            "A retirada na loja é a opção padrão e não tem custo. Avisamos por e-mail e WhatsApp quando o pedido está pronto.",
            "Quando o envio é combinado, o frete e o prazo são informados antes da confirmação.",
          ],
        },
        {
          id: "cancelamento",
          heading: "Cancelamento",
          paragraphs: [
            "Pedidos com pagamento pendente podem ser cancelados pelo atendimento.",
            "Após o início da produção de itens personalizados, o cancelamento depende da análise da loja, por se tratar de produto feito sob medida.",
          ],
        },
        {
          heading: "Problemas com a impressão",
          paragraphs: [
            "Se houver defeito de impressão ou divergência em relação à prévia aprovada, entre em contato com fotos do produto em até 7 dias corridos.",
            "A loja avalia o caso e providencia a reimpressão ou o reembolso quando o problema for confirmado.",
          ],
        },
        {
          heading: "Arquivos com baixa resolução",
          paragraphs: [
            "O editor avisa quando a foto não tem resolução suficiente. Se você optar por manter mesmo assim, a qualidade reduzida é uma escolha registrada no pedido.",
          ],
        },
      ]}
    />
  ),
});