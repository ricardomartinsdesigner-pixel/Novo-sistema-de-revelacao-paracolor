import { jsPDF } from "jspdf";

const INK = "#28231E";
const MUTED = "#635A50";
const ACCENT = "#9A6C2D";
const RULE = "#E7DFD3";
const LIGHT = "#F7F2EB";
const MARGIN = 14;
const LINE = 4.5;
const PAD = 2.5;
const CONTENT_TOP = 34;
const SECTION_HEIGHT = 9;

export function createReportPdf({ title, context }) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const width = pdf.internal.pageSize.getWidth() - MARGIN * 2;
  const bottom = pdf.internal.pageSize.getHeight() - 19;
  let y;

  function text(value, x, at, { size = 10, bold = false, color = INK, align = "left" } = {}) {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    pdf.text(String(value), x, at, { align });
  }

  function header() {
    text("PARACOLOR", MARGIN, 16, { size: 9, bold: true, color: ACCENT });
    text(title, MARGIN, 24, { size: 17, bold: true });
    pdf.setDrawColor(RULE);
    pdf.line(MARGIN, 28, MARGIN + width, 28);
    y = CONTENT_TOP;
  }

  function nextPage() {
    pdf.addPage("a4", "portrait");
    header();
  }

  function reserve(height) {
    if (y + height > bottom) nextPage();
  }

  function paragraph(value, { size = 10, color = INK } = {}) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(String(value || "—"), width);
    for (const line of lines) {
      reserve(LINE);
      text(line, MARGIN, y + 3.4, { size, color });
      y += LINE;
    }
    y += 2;
  }

  function section(label, keep = 12) {
    reserve(SECTION_HEIGHT + keep);
    text(label, MARGIN, y + 5, { size: 12, bold: true, color: INK });
    y += SECTION_HEIGHT;
  }

  function table(label, columns, rows) {
    const headers = columns.map((column) => column.label);
    function row(values, header = false, striped = false) {
      pdf.setFont("helvetica", header ? "bold" : "normal");
      pdf.setFontSize(9);
      const cells = columns.map(({ width: columnWidth }, index) =>
        pdf.splitTextToSize(String(values[index] ?? "—"), columnWidth - PAD * 2));
      const lineCount = Math.max(...cells.map((cell) => cell.length));
      const headerHeight = LINE + PAD * 2;
      const fullPageLines = Math.floor((bottom - CONTENT_TOP - SECTION_HEIGHT - headerHeight - PAD * 2) / LINE);
      let start = 0;
      while (start < lineCount) {
        const room = Math.floor((bottom - y - PAD * 2) / LINE);
        if (room < 1 || (!header && start === 0 && lineCount > room && lineCount <= fullPageLines)) {
          nextPage();
          section(label + " (continuação)");
          row(headers, true);
          continue;
        }
        const count = Math.min(room, lineCount - start);
        const height = count * LINE + PAD * 2;
        if (header || striped) {
          pdf.setFillColor(header ? LIGHT : "#FBF9F6");
          pdf.rect(MARGIN, y, width, height, "F");
        }
        let x = MARGIN;
        for (const [index, column] of columns.entries()) {
          const right = column.align === "right";
          cells[index].slice(start, start + count).forEach((line, lineIndex) => {
            text(line, right ? x + column.width - PAD : x + PAD, y + PAD + 3.1 + lineIndex * LINE,
              { size: 9, bold: header, align: right ? "right" : "left" });
          });
          x += column.width;
        }
        y += height;
        pdf.setDrawColor(RULE);
        pdf.line(MARGIN, y, MARGIN + width, y);
        start += count;
      }
    }
    section(label, 28);
    row(headers, true);
    if (!rows.length) paragraph("Nenhum registro para exibir.", { color: MUTED });
    for (const [index, values] of rows.entries()) row(values, false, index % 2 === 1);
    y += 6;
  }

  function finish() {
    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      pdf.setPage(page);
      pdf.setDrawColor(RULE);
      pdf.line(MARGIN, bottom + 3, MARGIN + width, bottom + 3);
      text("Paracolor", MARGIN, bottom + 9, { size: 8, color: MUTED });
      text(`Página ${page} de ${pages}`, MARGIN + width, bottom + 9, { size: 8, color: MUTED, align: "right" });
    }
    return pdf;
  }

  pdf.setProperties({ title, author: "Paracolor" });
  header();
  if (context) paragraph(context, { color: MUTED });
  return { section, paragraph, table, finish };
}
