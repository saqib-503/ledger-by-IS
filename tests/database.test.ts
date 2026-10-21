import test from "node:test";
import assert from "node:assert/strict";
import { database, asUser, uid, other } from "./database-helper";
import defaults from "../templates/defaults.json";
test("PostgreSQL migration, atomic saves, numbering, edits, snapshots, archive, RLS and precision", async () => {
  const db = await database();
  try {
    await asUser(db);
    const keys = Object.keys(defaults);
    await db.query(
      `insert into company_settings(owner_id,${keys.join(",")}) values($1,${keys.map((_, i) => "$" + (i + 2)).join(",")})`,
      [uid, ...Object.values(defaults)],
    );
    const c = await db.query<{ id: string }>(
      "insert into customers(owner_id,name,address,ntn) values($1,'Database Customer','Lahore','12345') returning id",
      [uid],
    );
    const customerId = c.rows[0].id;
    const input = {
      customer_id: customerId,
      date: "2026-09-05",
      status: "draft",
      sales_tax_rate: "18",
      advance_tax_rate: "0.5",
      notes: "",
      declaration: defaults.declaration,
      items: [
        {
          description: "Shirt",
          hs_code: "6109.1000",
          quantity: "256",
          rate: "810",
        },
      ],
      grand_total: "1",
    };
    async function save(
      kind: string,
      data = input,
      id: string | null = null,
      version: string | null = null,
    ) {
      return (
        await db.query<{ id: string }>(
          "select save_document($1,$2::jsonb,$3::uuid,$4) as id",
          [kind, JSON.stringify(data), id, version],
        )
      ).rows[0].id;
    }
    async function read(kind: string, id: string) {
      return (
        await db.query<{ doc: any }>(
          "select read_document($1,$2::uuid) as doc",
          [kind, id],
        )
      ).rows[0].doc;
    }
    const first = await save("invoice");
    let doc = await read("invoice", first);
    assert.match(doc.grand_total, /^245908\.2240*$/);
    assert.equal(Number(doc.grand_total), 245908.224);
    assert.equal(doc.number, "INV-0001");
    assert.equal(doc.items.length, 1);
    const second = await save("invoice");
    assert.equal((await read("invoice", second)).number, "INV-0002");
    assert.notEqual(first, second);
    const quotation = await save("quotation");
    const q = await read("quotation", quotation);
    assert.equal(q.number, "Q-0001");
    assert.equal(Number(q.sales_tax_amount), 0);
    const converted = await save("invoice", { ...input, items: q.items });
    assert.equal((await read("quotation", quotation)).number, "Q-0001");
    assert.equal(
      (await read("invoice", converted)).items[0].description,
      "Shirt",
    );
    await db.query(
      "update company_settings set company_name='Changed company' where owner_id=$1",
      [uid],
    );
    await db.query("update customers set name='Changed customer' where id=$1", [
      customerId,
    ]);
    await save("invoice", { ...input, notes: "Edited" }, first, doc.updated_at);
    const updated = await read("invoice", first);
    assert.equal(updated.notes, "Edited");
    assert.equal(updated.company_snapshot.company_name, defaults.company_name);
    assert.equal(updated.customer_snapshot.name, "Database Customer");
    await assert.rejects(
      () => save("invoice", input, first, doc.updated_at),
      /changed/,
    );
    await assert.rejects(
      () =>
        save("invoice", {
          ...input,
          items: [{ ...input.items[0], quantity: "-1" }],
        }),
      /Invalid line item/,
    );
    assert.equal((await db.query("select id from invoices")).rows.length, 3);
    await db.query("select archive_document($1,$2,true)", ["invoice", first]);
    assert.equal((await read("invoice", first)).archived, true);
    await db.query("select archive_document($1,$2,false)", ["invoice", first]);
    assert.equal((await read("invoice", first)).archived, false);
    await assert.rejects(
      () => db.query("update invoices set grand_total=1 where id=$1", [first]),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query("delete from invoices where id=$1", [first]),
      /permission denied/,
    );
    const decimal = await save("invoice", {
      ...input,
      sales_tax_rate: "0",
      advance_tax_rate: "0",
      items: [
        { description: "Decimal", hs_code: "", quantity: "0.1", rate: "0.2" },
      ],
    });
    assert.equal(Number((await read("invoice", decimal)).grand_total), 0.02);
    await asUser(db, other);
    assert.equal((await db.query("select * from invoices")).rows.length, 0);
    assert.equal(
      (await db.query("select * from invoice_items")).rows.length,
      0,
    );
    await assert.rejects(() => read("invoice", first), /not found/);
    await assert.rejects(() => save("invoice", input), /Customer not found/);
    await db.query("select archive_document($1,$2,true)", ["invoice", first]);
    await asUser(db);
    assert.equal((await read("invoice", first)).archived, false);
    console.log(
      "Verified schema, customer/settings persistence, invoice/quotation creation, edit conflict, duplicate numbers, conversion, exact totals, archive/restore, forbidden direct writes, and cross-user isolation.",
    );
  } finally {
    await db.close();
  }
});
