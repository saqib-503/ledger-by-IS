import type ExcelJS from "exceljs";
import type { Kind } from "./types";
const escape = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function rgb(color: Partial<ExcelJS.Color> | undefined, fallback: string) {
  return color?.argb ? "#" + color.argb.slice(-6) : fallback;
}
function value(cell: ExcelJS.Cell) {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date)
    return escape(v.toLocaleDateString("en-US", { timeZone: "UTC" }));
  if (typeof v === "object") {
    if ("formula" in v)
      return typeof v.result === "number"
        ? format(v.result, cell.numFmt)
        : escape(v.result);
    if ("richText" in v) return escape(v.richText.map((t) => t.text).join(""));
    if ("text" in v) return escape(v.text);
    return "";
  }
  return typeof v === "number" ? format(v, cell.numFmt) : escape(v);
}
function format(n: number, fmt: string) {
  if (fmt?.includes("0.00"))
    return (
      (fmt.includes("PKR") ? "PKR " : "") +
      n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  if (fmt?.includes("#,##0"))
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return String(n);
}
export function workbookHtml(
  workbook: ExcelJS.Workbook,
  kind: Kind,
  title: string,
  print = false,
) {
  const sheet = workbook.worksheets[0];
  const last = kind === "invoice" ? 12 : 9;
  const scale = kind === "invoice" ? 0.53 : 0.69;
  const header = kind === "invoice" ? 17 : 14;
  const totalItems = Math.max(
    kind === "invoice" ? 12 : 5,
    sheet.rowCount - (kind === "invoice" ? 29 : 26),
  );
  const itemEnd = header + totalItems;
  const merges = new Map<string, { rowspan: number; colspan: number }>();
  const skipped = new Set<string>();
  for (const range of sheet.model.merges) {
    const [a, b] = range.split(":");
    const first = sheet.getCell(a),
      end = sheet.getCell(b);
    for (let r = Number(first.row); r <= Number(end.row); r++)
      for (let c = Number(first.col); c <= Number(end.col); c++) {
        if (r === Number(first.row) && c === Number(first.col))
          merges.set(first.address, {
            rowspan: Number(end.row) - r + 1,
            colspan: Number(end.col) - c + 1,
          });
        else skipped.add(sheet.getCell(r, c).address);
      }
  }
  const indent = ((sheet.getColumn(1).width || 8.43) * 7.8 + 4) * scale;
  const available = 657 - indent;
  const weights = Array.from(
    { length: last - 1 },
    (_, i) => (sheet.getColumn(i + 2).width || 8.43) * 7.8 + 4,
  );
  const sum = weights.reduce((a, b) => a + b, 0);
  const cols = weights
    .map((w) => `<col style="width:${(w / sum) * available}px">`)
    .join("");
  function row(r: number) {
    let html = `<tr style="height:${(sheet.getRow(r).height || 15) * 1.333 * scale}px">`;
    for (let c = 2; c <= last; c++) {
      const cell = sheet.getCell(r, c);
      if (skipped.has(cell.address)) continue;
      const merge = merges.get(cell.address),
        style = cell.style,
        font = style.font,
        align = style.alignment;
      let css = `font-family:${escape(font?.name || "Arial")},sans-serif;font-size:${(font?.size || 11) * 1.333 * scale}px;color:${rgb(font?.color, "#000")};font-weight:${font?.bold ? "700" : "400"};font-style:${font?.italic ? "italic" : "normal"};text-align:${align?.horizontal || (typeof cell.value === "number" ? "right" : "left")};vertical-align:${align?.vertical || "middle"};white-space:pre-wrap;overflow-wrap:anywhere;`;
      const fill = style.fill;
      if (fill?.type === "pattern" && fill.pattern === "solid")
        css += `background:${rgb(fill.fgColor, "#fff")};`;
      for (const side of ["top", "bottom", "left", "right"] as const) {
        const edge =
          merge && (side === "right" || side === "bottom")
            ? sheet.getCell(
                r + (side === "bottom" ? merge.rowspan - 1 : 0),
                c + (side === "right" ? merge.colspan - 1 : 0),
              )
            : cell;
        const border = edge.border?.[side] || style.border?.[side];
        if (border?.style)
          css += `border-${side}:${["medium", "thick", "double"].includes(border.style) ? 2 : 1}px ${border.style === "double" ? "double" : "solid"} ${rgb(border.color, "#777")};`;
      }
      html += `<td ${merge ? `rowspan="${merge.rowspan}" colspan="${merge.colspan}"` : ""} style="${css}">${value(cell)}</td>`;
    }
    return html + "</tr>";
  }
  const section = (start: number, end: number, thead = false) =>
    `<table><colgroup>${cols}</colgroup>${thead ? "<thead>" + row(start) + "</thead>" : ""}<tbody>${Array.from({ length: Math.max(0, end - start + (thead ? 0 : 1)) }, (_, i) => row(start + i + (thead ? 1 : 0))).join("")}</tbody></table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>@page{size:A4 portrait;margin:19.05mm 17.78mm}*{box-sizing:border-box}body{margin:0;font-family:Arial;background:white}main{width:max-content;max-width:100%;margin:${15 * 1.333 * scale}px 0 0 ${indent}px}table{border-collapse:collapse;table-layout:fixed}td{padding:0 2px;line-height:1.18}tr{break-inside:avoid}thead{display:table-header-group}.footer{break-inside:avoid}@media screen{body{padding:28px;min-width:690px}}@media print{body{padding:0}main{margin:${15 * 1.333 * scale}px 0 0 ${indent}px}a{color:inherit}}</style></head><body><main>${section(2, header - 1)}${section(header, itemEnd, true)}<div class="footer">${section(itemEnd + 1, sheet.rowCount)}</div></main>${print ? '<script>window.addEventListener("load",()=>window.print())</script>' : ""}</body></html>`;
}
