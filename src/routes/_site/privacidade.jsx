import { createFileRoute } from "@tanstack/react-router";
import LegalContent from "@/components/site/LegalContent";

export const Route = createFileRoute("/_site/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — Paracolor" },
      { name: "description", content: "Como a Paracolor trata seus dados e as fotos enviadas para impressão." },
    ],
  }),
  component: () => (
    <LegalContent
      title="Política de privacidade"
      updated="novembro de 2026"
      sections={[
        {
          heading: "Quais dados coletamos",
          paragraphs: [
            "Coletamos os dados necessários para produzir e entregar seu pedido: nome, e-mail, telefone, CPF (quando exigido para nota fiscal) e endereço de entrega.",
            "As fotos e arquivos que você envia são usados exclusivamente para a produção do pedido.",
            "Para mostrar estatísticas de acesso à loja, salvamos no seu navegador um identificador aleatório, sem usar seu nome, telefone ou fotos. Registramos páginas visitadas e atividade recente para contar navegadores únicos e atividade online. A retenção padrão é de 400 dias e pode ser ajustada pela loja até o limite de 730 dias; limpar os dados do navegador remove o identificador salvo no aparelho.",
          ],
        },
        {
          heading: "Como as fotos são guardadas",
          paragraphs: [
            "As imagens ficam em armazenamento privado, acessíveis apenas por links temporários para você e para a produção da Paracolor.",
            "Não publicamos suas fotos nem as utilizamos em divulgação sem autorização expressa.",
          ],
        },
        {
          heading: "Compartilhamento",
          paragraphs: [
            "Compartilhamos dados apenas com meios de pagamento e transportadoras estritamente para concluir o pedido, ou quando exigido por lei.",
          ],
        },
        {
          heading: "Seus direitos (LGPD)",
          paragraphs: [
            "Você pode solicitar acesso, correção ou exclusão dos seus dados e arquivos pelo canal de atendimento da loja.",
            "Arquivos de pedidos concluídos podem ser mantidos pelo prazo necessário para garantia e obrigações fiscais.",
          ],
        },
      ]}
    />
  ),
});
