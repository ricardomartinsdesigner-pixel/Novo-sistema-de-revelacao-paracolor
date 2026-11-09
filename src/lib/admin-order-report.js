import { createReportPdf } from "./admin-report-pdf.js";
import { formatBRL, formatDate, STATUS_LABELS } from "./areas.js";
import { PAYMENT_METHOD_LABELS } from "./order-payment.js";
import { AREA_LABELS, copiesOf, orderLabel, sizeLabel } from "./order-paths.js";

const FIELD_COLUMNS = [{ label: "Campo", width: 48 }, { label: "Informação", width: 134 }];
const ART_LABELS = {
  nao_requerida: "Não solicitada", nao_solicitada: "Não solicitada", aguardando: "Aguardando aprovação",
  aprovada: "Aprovada", ajustes: "Ajustes solicitados",
};

function itemDescription(item) {
  const options = item.options || {};
  return [
    item.product_name,
    [AREA_LABELS[item.area] || item.area, item.variant].filter(Boolean).join(" · "),
    options.material_name ? `Material: ${options.material_name}` : "",
    Array.isArray(options.finish_names) && options.finish_names.length ? `Acabamentos: ${options.finish_names.join(", ")}` : "",
    options.art_mode === "equipe" ? "Criação da arte pela equipe" : "",
    options.art_original_name ? `Arquivo de arte: ${options.art_original_name}` : "",
    ...Object.entries(options.text_values || {}).filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`),
    options.instructions ? `Instruções: ${options.instructions}` : "",
  ].filter(Boolean).join("\n");
}

export function buildOrderPdf({ order, items, photos, summary, kind }) {
  const production = kind === "production";
  const title = production ? "Ficha de produção" : "Relatório do pedido";
  const report = createReportPdf({ title, context: `Pedido ${orderLabel(order)} · Registrado em ${formatDate(order.created_date)}` });
  report.table("Dados do pedido", FIELD_COLUMNS, [
    ["Cliente", order.customer_name || "—"],
    ["Telefone", order.customer_phone || "—"],
    ...(!production ? [["E-mail", order.customer_email || "—"], ["CPF", order.customer_cpf || "—"]] : []),
    ["Recebimento", order.fulfillment === "entrega" ? ["Entrega", order.shipping_address].filter(Boolean).join("\n") : "Retirada na loja"],
    ["Status do pedido", STATUS_LABELS[order.status] || order.status],
    ["Aprovação de arte", ART_LABELS[order.art_approval_status] || order.art_approval_status || "—"],
    ...(order.quick_due_at ? [["Prazo de produção", formatDate(order.quick_due_at)]] : []),
    ...(order.gift_message ? [["Mensagem de presente", order.gift_message]] : []),
  ]);

  report.table("Resumo para o envelope", [{ label: "Qtd.", width: 21, align: "right" }, { label: "Item", width: 161 }],
    summary.map(({ count, title: item }) => [count, item]));

  if (!production) {
    report.table("Pagamento", FIELD_COLUMNS, [
      ["Método", PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method || "—"],
      ["Situação", order.payment_status || "—"],
      ["Recebido em", formatDate(order.payment_approved_at)],
      ["Subtotal", formatBRL(order.subtotal)],
      ["Desconto", formatBRL(order.discount)],
      ["Frete", formatBRL(order.shipping_cost)],
      ["Total", formatBRL(order.total)],
      ["Campanha ou cupom", order.discount_label || order.coupon_code || "—"],
    ]);
  }

  report.table("Itens do pedido", [
    { label: "Produto e detalhes", width: 129 }, { label: "Qtd.", width: 17, align: "right" },
    { label: "Total", width: 36, align: "right" },
  ], items.map((item) => [itemDescription(item), item.qty, formatBRL(item.line_total)]));

  report.table(`Fotos e arquivos (${photos.length})`, [
    { label: "Nº", width: 13 }, { label: "Arquivo", width: 56 },
    { label: "Tamanho e cópias", width: 34 }, { label: "Detalhes de impressão", width: 79 },
  ], photos.map((photo, index) => {
    const size = sizeLabel(photo);
    const copies = copiesOf(photo);
    return [
      index + 1,
      photo.filename || "Foto",
      [size === "Sem_tamanho" ? "" : size, `${copies} ${copies === 1 ? "cópia" : "cópias"}`].filter(Boolean).join("\n"),
      [
        AREA_LABELS[photo.area],
        photo.fit_mode ? (photo.fit_mode === "contain" ? "Foto inteira" : "Preenchida") : "",
        ["revelacao", "polaroid"].includes(photo.area) ? (photo.border ? "Com borda" : "Sem borda") : "",
        photo.caption ? `Legenda: ${photo.caption}` : "",
        ...(Array.isArray(photo.alerts) ? photo.alerts : []),
      ].filter(Boolean).join("\n"),
    ];
  }));

  return report.finish();
}
