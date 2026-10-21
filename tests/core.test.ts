import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildWorkbook } from "../src/lib/excel";
import { workbookHtml } from "../src/lib/print";
import { calculate, money, wholeMoney } from "../src/lib/calculations";
import { documentSchema } from "../src/lib/validation";
import defaults from "../templates/defaults.json";
import type { Document, Kind } from "../src/lib/types";
import fs from "node:fs/promises";
export function fixture(count = 1): Document {
  return {
    id: "b4dc01ac-cbc0-4cf2-8e9d-171c9e5d23a9",
    number: "INV-0001",
    customer_id: "b4dc01ac-cbc0-4cf2-8e9d-171c9e5d23a8",
    date: "2026-09-05",
    status: "draft",
    archived: false,
    notes: "",
    declaration: defaults.declaration,
    sales_tax_rate: "18",
    advance_tax_rate: "0.5",
    ...calculate(
      [
        {
          description: "Cotton T-shirt",
          hs_code: "6109.1000",
          quantity: "256",
          rate: "810",
        },
      ],
      "18",
      "0.5",
    ),
    customer_snapshot: {
      id: "b4dc01ac-cbc0-4cf2-8e9d-171c9e5d23a8",
      name: "Test Apparel Ltd.",
      address: "Sample business address, Lahore",
      ntn: "1234567",
      strn: "1234567890123",
      phone: "",
      email: "",
    },
    company_snapshot: defaults,
    items: Array.from({ length: count }, (_, i) => ({
      description: "Cotton T-shirt " + (i + 1),
      hs_code: "6109.1000",
      quantity: "256",
      rate: "810",
    })),
    updated_at: "2026-09-05T00:00:00Z",
  };
}
test("invoice tax matches original unrounded Excel arithmetic", () => {
  const totals = calculate(fixture().items, "18", "0.5");
  assert.deepEqual(totals, {
    subtotal: "207360",
    sales_tax_amount: "37324.8",
    value_including_tax: "244684.8",
    advance_tax_amount: "1223.424",
    grand_total: "245908.224",
  });
  assert.equal(wholeMoney(totals.grand_total), "245,908");
});
test("zero tax and fractional quantities avoid floating point drift", () => {
  assert.equal(
    calculate(
      [{ description: "x", hs_code: "", quantity: "0.1", rate: "0.2" }],
      "0",
      "0",
    ).grand_total,
    "0.02",
  );
  assert.equal(money("1234.567"), "1,234.57");
  assert.equal(
    calculate(
      [{ description: "x", hs_code: "", quantity: "1.2345", rate: "2.3456" }],
      "18",
      "0.5",
    ).grand_total,
    "3.43394327088",
  );
});
test("server validation rejects missing/invalid financial inputs", () => {
  for (const patch of [
    { items: [] },
    { date: "2026-02-30" },
    { sales_tax_rate: "-1" },
    { advance_tax_rate: "101" },
    { items: [{ ...fixture().items[0], quantity: "0" }] },
    { items: [{ ...fixture().items[0], rate: "1.00001" }] },
    { items: [{ ...fixture().items[0], description: " " }] },
  ])
    assert.equal(
      documentSchema.safeParse({ ...fixture(), ...patch }).success,
      false,
    );
  assert.equal(documentSchema.safeParse(fixture()).success, true);
});
for (const kind of ["invoice", "quotation"] as Kind[])
  for (const count of [1, 5, 12, 13, 60])
    test(`${kind} template export with ${count} rows preserves styles, merges and data`, async () => {
      const doc = fixture(count);
      if (kind === "quotation") doc.number = "Q-0001";
      const wb = await buildWorkbook(kind, doc),
        s = wb.worksheets[0];
      const original = new ExcelJS.Workbook();
      await original.xlsx.readFile(
        `templates/${kind === "invoice" ? "Invoice" : "Quotation"}.xlsx`,
      );
      const source = original.worksheets[0];
      const start = kind === "invoice" ? 18 : 15,
        capacity = kind === "invoice" ? 12 : 5,
        extra = Math.max(0, count - capacity);
      assert.equal(s.getCell("B2").value, defaults.company_name);
      assert.deepEqual(s.getCell("B2").style, source.getCell("B2").style);
      assert.equal(s.getColumn(2).width, source.getColumn(2).width);
      assert.equal(s.getRow(2).height, source.getRow(2).height);
      assert.equal(
        s.getCell("B" + (start + count - 1)).value,
        "Cotton T-shirt " + count,
      );
      assert.equal(
        s.getCell(kind === "invoice" ? "K5" : "G5").value,
        doc.number,
      );
      assert.equal(
        s.getCell(kind === "invoice" ? "B12" : "B10").value,
        doc.customer_snapshot.name,
      );
      assert.ok(
        s.model.merges.includes(
          kind === "invoice"
            ? `B${start + count - 1}:G${start + count - 1}`
            : `B${start + count - 1}:F${start + count - 1}`,
        ),
      );
      assert.equal(s.pageSetup.fitToHeight, 0);
      if (kind === "invoice") {
        assert.equal(
          (s.getCell("L" + (31 + extra)).value as ExcelJS.CellFormulaValue)
            .formula,
          `SUM(L18:L${29 + extra})`,
        );
        assert.equal(
          (s.getCell("L" + (36 + extra)).value as ExcelJS.CellFormulaValue)
            .result,
          Number(calculate(doc.items, "18", "0.5").grand_total),
        );
      } else {
        assert.equal(s.getCell("B" + (22 + extra)).value, doc.declaration);
        assert.ok(s.model.merges.includes(`B${22 + extra}:I${25 + extra}`));
      }
      const buffer = await wb.xlsx.writeBuffer();
      const roundtrip = new ExcelJS.Workbook();
      await roundtrip.xlsx.load(buffer);
      assert.equal(
        roundtrip.worksheets[0].getCell("B2").value,
        defaults.company_name,
      );
      const html = workbookHtml(wb, kind, doc.number);
      assert.ok(html.includes("table-header-group"));
      assert.ok(!html.includes("One Life Apparel"));
      assert.ok(!html.includes("TROUSER"));
      if (count === 1 || count === 60) {
        await fs.mkdir("artifacts", { recursive: true });
        await fs.writeFile(
          `artifacts/${kind}-${count}.xlsx`,
          new Uint8Array(buffer),
        );
        await fs.writeFile(`artifacts/${kind}-${count}.html`, html);
      }
    });
test("HTML safely escapes user text", async () => {
  const doc = fixture();
  doc.items[0].description = "<script>alert(1)</script>";
  const html = workbookHtml(
    await buildWorkbook("invoice", doc),
    "invoice",
    "<script>x</script>",
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});
