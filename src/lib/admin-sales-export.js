import { formatBRL, STATUS_LABELS } from "./areas.js";
import { AREA_LABELS } from "./order-paths.js";
import { csvRow } from "./admin-csv.js";

const PAYMENT = { aprovado: "Aprovado", pendente: "Pendente", recusado: "Recusado", reembolsado: "Reembolsado", teste_aprovado: "Teste aprovado" };
const TIME_ZONE = "America/Sao_Paulo";
const money = (value) => Number(value) || 0;
export const dayLabel = (value) => value?.slice(0, 10).split("-").reverse().join("/") || "—";
export const basisLabel = (basis) => basis === "recebimento" ? "Data do recebimento" : "Data do pedido";

export function salesReportData(sales, basis) {
  const period = `${dayLabel(sales.period.from)} a ${dayLabel(sales.period.to)}`;
  const summary = [
    ["Pedidos exibidos no período", sales.detailCount],
    ["Pedidos com pagamento aprovado", sales.paidCount],
    ["Faturamento aprovado", sales.revenue, true],
    ["Descontos em pedidos aprovados", sales.discounts, true],
    ["Frete em pedidos aprovados", sales.shipping, true],
    ["Ticket médio dos pedidos aprovados", sales.paidCount ? sales.revenue / sales.paidCount : 0, true],
    ["Cópias de fotos e polaroides vendidas", sales.photoCopies],
  ];
  const notes = [
    "Os subtotais por categoria consideram os itens dos pedidos com pagamento aprovado, antes dos descontos e do frete.",
    "O faturamento aprovado soma o valor final dos pedidos com pagamento aprovado. O ticket médio divide esse valor pela quantidade de pedidos aprovados.",
  ];
  if (basis === "recebimento" && sales.undatedReceipts > 0) {
    notes.push(`${sales.undatedReceipts} pagamento(s) aprovado(s) sem data registrada ficaram fora do filtro por recebimento.`);
  }
  return {
    period, basis: basisLabel(basis), name: `paracolor-relatorio-${basis}-${sales.period.from}-a-${sales.period.to}`,
    generated: new Date().toLocaleString("pt-BR", { timeZone: TIME_ZONE }), summary, notes,
    categories: sales.areas.map((row) => [AREA_LABELS[row.area] || row.area, Number(row.count), money(row.subtotal)]),
    orders: sales.details.map((row) => [
      row.order_number || "—", dayLabel(row.reference_day), row.customer_name || "—", STATUS_LABELS[row.status] || row.status || "—",
      PAYMENT[row.payment_status] || row.payment_status || "—", money(row.subtotal), money(row.discount), money(row.shipping), money(row.total),
    ]),
  };
}

export function downloadReport(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const CATEGORY_HEADERS = ["Categoria", "Linhas de itens", "Subtotal dos itens"];
const ORDER_HEADERS = ["Pedido", "Data do filtro", "Cliente", "Status", "Pagamento", "Subtotal", "Desconto", "Frete", "Total"];

export function exportSalesCsv(data) {
  const decimal = (value) => money(value).toFixed(2).replace(".", ",");
  const rows = [
    ["Paracolor — Relatório de vendas"], ["Período", data.period], ["Filtro", data.basis],
    ["Gerado em", data.generated], [], ["Resumo do período"],
    ...data.summary.map(([label, value, monetary]) => [label, monetary ? decimal(value) : value]),
    [], ["Vendas por categoria"], CATEGORY_HEADERS, ...data.categories.map(([label, count, subtotal]) => [label, count, decimal(subtotal)]),
    [], ["Pedidos do período"], ORDER_HEADERS, ...data.orders.map((row) => [...row.slice(0, 5), ...row.slice(5).map(decimal)]),
    [], ["Como ler o relatório"], ...data.notes.map((note) => [note]),
  ];
  downloadReport(new Blob(["\uFEFF", rows.map(csvRow).join("\r\n")], { type: "text/csv;charset=utf-8" }), data.name + ".csv");
}

export async function buildSalesPdf(data) {
  const { createReportPdf } = await import("./admin-report-pdf.js");
  const report = createReportPdf({ title: "Relatório de vendas", context: `Período ${data.period} | ${data.basis} | Gerado em ${data.generated}` });
  report.table("Resumo do período", [{ label: "Indicador", width: 124 }, { label: "Resultado", width: 58, align: "right" }],
    data.summary.map(([label, value, monetary]) => [label, monetary ? formatBRL(value) : value]));
  report.table("Vendas por categoria", [{ label: CATEGORY_HEADERS[0], width: 86 }, { label: CATEGORY_HEADERS[1], width: 44, align: "right" },
    { label: CATEGORY_HEADERS[2], width: 52, align: "right" }],
    data.categories.map(([label, count, subtotal]) => [label, count, formatBRL(subtotal)]));
  report.section("Como ler o relatório");
  data.notes.forEach((note) => report.paragraph(note));
  report.table("Pedidos do período", [
    { label: "Pedido e data do filtro", width: 49 }, { label: "Cliente", width: 48 },
    { label: "Status e pagamento", width: 44 }, { label: "Valores", width: 41 },
  ], data.orders.map(([id, date, customer, status, payment, subtotal, discount, shipping, total]) => [
    id + "\n" + date, customer, status + "\n" + payment,
    `Subtotal ${formatBRL(subtotal)}\nDesconto ${formatBRL(discount)}\nFrete ${formatBRL(shipping)}\nTotal ${formatBRL(total)}`,
  ]));
  return report.finish();
}

export async function exportSalesExcel(data) {
  const { default: Excel } = await import("exceljs");
  const workbook = new Excel.Workbook();
  workbook.creator = "Paracolor";
  const currencyFormat = '"R$" #,##0.00';
  const metadata = [["Período", data.period], ["Filtro", data.basis], ["Gerado em", data.generated]];
  function worksheet(name, headers, rows, widths, monetaryColumns = []) {
    const sheet = workbook.addWorksheet(name, { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true,
      fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:5" }, views: [{ state: "frozen", ySplit: 5 }] });
    sheet.headerFooter.oddFooter = "&LParacolor&R Página &P de &N";
    sheet.addRow(["Paracolor — " + name]);
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.addRows(metadata);
    const header = sheet.addRow(headers);
    header.font = { bold: true, color: { argb: "FF342719" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0E7D9" } };
    sheet.addRows(rows);
    widths.forEach((width, index) => {
      const column = sheet.getColumn(index + 1);
      column.width = width;
      column.alignment = { wrapText: true, vertical: "top" };
    });
    sheet.pageSetup.margins = { left: 0.45, right: 0.45, top: 0.55, bottom: 0.55, header: 0.2, footer: 0.25 };
    for (const index of monetaryColumns) {
      for (let row = 6; row <= sheet.rowCount; row++) sheet.getCell(row, index).numFmt = currencyFormat;
    }
    return sheet;
  }
  const overview = worksheet("Resumo", ["Indicador", "Resultado"], data.summary.map(([label, value]) => [label, value]), [54, 35]);
  data.summary.forEach(([, , monetary], index) => { if (monetary) overview.getCell(6 + index, 2).numFmt = currencyFormat; });
  overview.addRow([]);
  overview.addRow(["Como ler o relatório"]).font = { bold: true };
  for (const note of data.notes) {
    const row = overview.addRow([note]);
    overview.mergeCells(row.number, 1, row.number, 2);
    row.getCell(1).alignment = { wrapText: true, vertical: "middle" };
    row.height = 30;
  }
  worksheet("Categorias", CATEGORY_HEADERS, data.categories, [30, 21, 24], [3]);
  const orders = worksheet("Pedidos", ORDER_HEADERS, data.orders, [34, 17, 32, 26, 17, 14, 14, 14, 14], [6, 7, 8, 9]);
  if (data.orders.length) orders.autoFilter = "A5:I" + orders.rowCount;
  const bytes = await workbook.xlsx.writeBuffer();
  downloadReport(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), data.name + ".xlsx");
}
