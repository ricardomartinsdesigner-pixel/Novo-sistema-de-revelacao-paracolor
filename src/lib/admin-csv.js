export function csvRow(cells) {
  return cells.map((cell) => {
    const text = String(cell ?? "");
    const safe = /^\s*[=+\-@]|^[\t\r\n]/.test(text) && typeof cell !== "number" ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  }).join(";");
}
