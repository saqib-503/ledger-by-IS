import ExcelJS from "exceljs";
import path from "node:path";
import type { Document, Kind } from "./types";
import { calculate } from "./calculations";
function shiftRange(range: string, at: number, count: number) {
  return range.replace(
    /([A-Z]+)(\d+)/g,
    (_, col, row) =>
      col + (Number(row) >= at ? Number(row) + count : Number(row)),
  );
}
export async function buildWorkbook(kind: Kind, doc: Document) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(
    path.join(
      process.cwd(),
      "templates",
      kind === "invoice" ? "Invoice.xlsx" : "Quotation.xlsx",
    ),
  );
  const sheet = workbook.worksheets[0];
  const start = kind === "invoice" ? 18 : 15,
    capacity = kind === "invoice" ? 12 : 5,
    end = start + capacity;
  const extra = Math.max(0, doc.items.length - capacity);
  const originalMerges = [...sheet.model.merges];
  if (extra) {
    const sourceStyles = new Map<string, Partial<ExcelJS.Style>>();
    sheet.eachRow({ includeEmpty: true }, (row) =>
      row.eachCell({ includeEmpty: true }, (cell) =>
        sourceStyles.set(cell.address, structuredClone(cell.style)),
      ),
    );
    const styleRow = sheet.getRow(end - 1);
    const styles = Array.from({ length: sheet.columnCount }, (_, n) =>
      structuredClone(styleRow.getCell(n + 1).style),
    );
    originalMerges.forEach((m) => sheet.unMergeCells(m));
    sheet.spliceRows(end, 0, ...Array.from({ length: extra }, () => []));
    for (let r = end; r < end + extra; r++) {
      sheet.getRow(r).height = 30.7;
      styles.forEach(
        (s, n) => (sheet.getRow(r).getCell(n + 1).style = structuredClone(s)),
      );
    }
    originalMerges.forEach((m) => sheet.mergeCells(shiftRange(m, end, extra)));
    for (let r = end; r < end + extra; r++) {
      sheet.mergeCells(kind === "invoice" ? `B${r}:G${r}` : `B${r}:F${r}`);
      sheet.mergeCells(kind === "invoice" ? `J${r}:K${r}` : `H${r}:I${r}`);
    }
    for (const [address, style] of sourceStyles)
      sheet.getCell(shiftRange(address, end, extra)).style = style;
    for (let r = end; r < end + extra; r++)
      styles.forEach(
        (style, n) =>
          (sheet.getRow(r).getCell(n + 1).style = structuredClone(style)),
      );
  }
  const put = (cell: string, value: ExcelJS.CellValue) => {
    sheet.getCell(cell).value = value;
  };
  const c = doc.company_snapshot,
    customer = doc.customer_snapshot;
  const address =
    (kind === "quotation" ? c.quotation_address : c.address) || c.address;
  const lines = address.split("\n");
  put("B2", c.company_name);
  put("B4", lines[0] || "");
  put("B5", lines.slice(1).join(", "));
  put("B6", c.phone ? "Phone # " + c.phone : "");
  put("B7", c.secondary_phone || "");
  if (kind === "invoice") {
    put("B9", c.ntn ? "NTN: " + c.ntn : "");
    put("K4", new Date(doc.date + "T00:00:00Z"));
    put("K5", doc.number);
    put("B12", customer.name);
    put("B13", customer.address);
    put("B14", customer.ntn ? "NTN: " + customer.ntn : "");
    put("B15", customer.strn ? "STRN: " + customer.strn : "");
  } else {
    put("I4", new Date(doc.date + "T00:00:00Z"));
    sheet.mergeCells("G5:I5");
    put("G5", doc.number);
    sheet.getCell("G5").style = {
      font: { name: "Arial", size: 12 },
      alignment: { horizontal: "right" },
    };
    put("B10", customer.name);
    sheet.mergeCells("B13:I13");
    put(
      "B13",
      [
        customer.address,
        customer.ntn ? "NTN: " + customer.ntn : "",
        customer.strn ? "STRN: " + customer.strn : "",
      ]
        .filter(Boolean)
        .join(" · "),
    );
    sheet.getCell("B13").style = {
      font: { name: "Arial", size: 10 },
      alignment: { wrapText: true },
    };
  }
  const totalRows = Math.max(capacity, doc.items.length);
  for (let n = 0; n < totalRows; n++) {
    const row = start + n,
      item = doc.items[n];
    const columns =
      kind === "invoice" ? ["B", "H", "I", "J", "L"] : ["B", "G", "H"];
    columns.forEach((col) => put(col + row, null));
    if (item) {
      put("B" + row, item.description);
      sheet.getCell("B" + row).alignment = {
        ...sheet.getCell("B" + row).alignment,
        wrapText: true,
      };
      sheet.getRow(row).height = Math.max(
        30.7,
        Math.ceil(item.description.length / (kind === "invoice" ? 60 : 55)) *
          18,
      );
      put((kind === "invoice" ? "I" : "G") + row, Number(item.quantity));
      put((kind === "invoice" ? "J" : "H") + row, Number(item.rate));
      if (kind === "invoice") {
        put("H" + row, item.hs_code);
        put("L" + row, {
          formula: `IF(OR(I${row}="",J${row}=""),"",I${row}*J${row})`,
          result: Number(calculate([item], "0", "0").subtotal),
        });
      }
    }
  }
  if (kind === "invoice") {
    const t = calculate(
      doc.items,
      String(doc.sales_tax_rate),
      String(doc.advance_tax_rate),
    );
    put("L" + (31 + extra), {
      formula: `SUM(L18:L${29 + extra})`,
      result: Number(t.subtotal),
    });
    put("H" + (32 + extra), `Tax Rate @ ${doc.sales_tax_rate}%`);
    put("L" + (32 + extra), {
      formula: `L${31 + extra}*${doc.sales_tax_rate}%`,
      result: Number(t.sales_tax_amount),
    });
    put("L" + (33 + extra), {
      formula: `L${31 + extra}+L${32 + extra}`,
      result: Number(t.value_including_tax),
    });
    put("H" + (34 + extra), `Advance Tax @ ${doc.advance_tax_rate}%`);
    put("L" + (34 + extra), {
      formula: `L${33 + extra}*${doc.advance_tax_rate}%`,
      result: Number(t.advance_tax_amount),
    });
    put("L" + (36 + extra), {
      formula: `L${33 + extra}+L${34 + extra}`,
      result: Number(t.grand_total),
    });
    put("B" + (34 + extra), "Bank Name: " + c.bank_name);
    put("B" + (35 + extra), "Branch : " + c.bank_branch);
    put("B" + (36 + extra), "Account Title: " + c.account_title);
    put("B" + (37 + extra), "Account #" + c.account_number);
    const detail = [
      c.iban ? "IBAN: " + c.iban : "",
      c.email,
      c.strn ? "STRN: " + c.strn : "",
      doc.notes,
    ]
      .filter(Boolean)
      .join("\n");
    if (detail) {
      sheet.mergeCells(`B${38 + extra}:L${39 + extra}`);
      put("B" + (38 + extra), detail);
      sheet.getCell("B" + (38 + extra)).style = {
        font: { name: "Arial", size: 10 },
        alignment: { wrapText: true, vertical: "top" },
      };
      sheet.getRow(38 + extra).height = Math.max(
        30.7,
        Math.ceil(detail.length / 100) * 15,
      );
    }
  } else {
    put("B" + (22 + extra), doc.declaration);
    sheet.getCell("B" + (22 + extra)).alignment = {
      ...sheet.getCell("B" + (22 + extra)).alignment,
      wrapText: true,
    };
    const length = Math.ceil(doc.declaration.length / 95) * 16;
    if (length > 122) sheet.getRow(22 + extra).height = 30.7 + length - 122;
    if (doc.notes) {
      sheet.mergeCells(`B${26 + extra}:I${27 + extra}`);
      put("B" + (26 + extra), doc.notes);
      sheet.getCell("B" + (26 + extra)).style = {
        font: { name: "Arial", size: 10 },
        alignment: { wrapText: true, vertical: "top" },
      };
      sheet.getRow(26 + extra).height = Math.max(
        30.7,
        Math.ceil(doc.notes.length / 95) * 15,
      );
    }
  }
  sheet.pageSetup = {
    ...sheet.pageSetup,
    paperSize: 9,
    orientation: "portrait",
    fitToPage: extra > 0,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: `A1:${kind === "invoice" ? "L" : "I"}${(kind === "invoice" ? 41 : 28) + extra}`,
    printTitlesRow: kind === "invoice" ? "17:17" : "14:14",
  };
  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}
