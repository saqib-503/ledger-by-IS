import test from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";
import { database, asUser, uid, other } from "./database-helper";
import defaults from "../templates/defaults.json";
test("Accounting lifecycle: balanced posting, orders, bills, settlements, reports, reversals, locks and isolation", async () => {
  const db = await database();
  try {
    await asUser(db);
    const command = async (action: string, data: unknown = {}) =>
      (
        await db.query<{ r: any }>(
          "select accounting_command($1,$2::jsonb) r",
          [action, JSON.stringify(data)],
        )
      ).rows[0].r;
    const report = async (
      from = "2026-09-01",
      to = "2026-09-30",
      account: string | null = null,
      party: string | null = null,
      partyKind: string | null = null,
    ) =>
      (
        await db.query<{ r: any }>(
          "select accounting_report($1,$2,$3,$4,$5) r",
          [from, to, account, party, partyKind],
        )
      ).rows[0].r;
    const doc = async (kind: string, id: string) =>
      (
        await db.query<{ r: any }>("select accounting_document($1,$2) r", [
          kind,
          id,
        ])
      ).rows[0].r;
    await command("initialize");
    await command("initialize");
    const accounts = (
      await db.query<{ id: string; system_key: string }>(
        "select * from accounts",
      )
    ).rows;
    assert.equal(accounts.length, 14);
    const a = (key: string) => accounts.find((x) => x.system_key === key)!.id;
    const keys = Object.keys(defaults);
    await db.query(
      `insert into company_settings(owner_id,${keys.join(",")}) values($1,${keys.map((_, i) => "$" + (i + 2)).join(",")})`,
      [uid, ...Object.values(defaults)],
    );
    const customer = (
      await db.query<{ id: string }>(
        "insert into customers(owner_id,name) values($1,'Accounting customer') returning id",
        [uid],
      )
    ).rows[0].id;
    const supplier = (
      await command("save_supplier", { name: "Accounting supplier" })
    ).id;
    await command("save_journal", {
      date: "2026-09-01",
      memo: "Opening capital",
      source_type: "opening",
      post: true,
      lines: [
        { account_id: a("cash"), debit: "10000" },
        { account_id: a("capital"), credit: "10000" },
      ],
    });
    await assert.rejects(
      () =>
        command("save_journal", {
          date: "2026-09-01",
          memo: "Bad opening",
          source_type: "opening",
          post: true,
          lines: [
            { account_id: a("cash"), debit: "1" },
            { account_id: a("sales"), credit: "1" },
          ],
        }),
      /balance-sheet/,
    );
    const countBefore = (await db.query("select id from journals")).rows.length;
    await assert.rejects(
      () =>
        command("save_journal", {
          date: "2026-09-01",
          memo: "Unbalanced",
          post: true,
          lines: [
            { account_id: a("cash"), debit: "2" },
            { account_id: a("capital"), credit: "1" },
          ],
        }),
      /Debits must equal/,
    );
    assert.equal(
      (await db.query("select id from journals")).rows.length,
      countBefore,
    );
    const line = {
      description: "Service",
      hs_code: "",
      quantity: "1",
      rate: "100",
    };
    const order = (
      await command("save_order", {
        kind: "sales",
        date: "2026-09-02",
        party_id: customer,
        items: [line],
      })
    ).id;
    assert.equal((await report()).income, "0");
    await assert.rejects(
      () => command("convert_order", { id: order }),
      /Confirm/,
    );
    await command("order_status", { id: order, status: "confirmed" });
    const converted = await command("convert_order", { id: order });
    assert.equal(converted.kind, "invoice");
    assert.equal(
      (await command("convert_order", { id: order })).id,
      converted.id,
    );
    let inv = (
      await db.query<{ r: any }>("select read_document($1,$2) r", [
        "invoice",
        converted.id,
      ])
    ).rows[0].r;
    await db.query("select save_document($1,$2::jsonb,$3,$4)", [
      "invoice",
      JSON.stringify({
        ...inv,
        date: "2026-09-02",
        status: "issued",
        items: [line],
      }),
      inv.id,
      inv.updated_at,
    ]);
    const posted = (await command("post_invoice", { id: inv.id })).id;
    assert.equal((await command("post_invoice", { id: inv.id })).id, posted);
    inv = (
      await db.query<{ r: any }>("select read_document($1,$2) r", [
        "invoice",
        inv.id,
      ])
    ).rows[0].r;
    await assert.rejects(
      () =>
        db.query("select save_document($1,$2::jsonb,$3,$4)", [
          "invoice",
          JSON.stringify({ ...inv, notes: "tampered" }),
          inv.id,
          inv.updated_at,
        ]),
      /immutable/,
    );
    const po = (
      await command("save_order", {
        kind: "purchase",
        date: "2026-09-02",
        party_id: supplier,
        items: [{ ...line, quantity: "2", rate: "30" }],
      })
    ).id;
    await command("order_status", { id: po, status: "confirmed" });
    const billResult = await command("convert_order", { id: po });
    let bill = await doc("bill", billResult.id);
    await command("save_bill", {
      id: bill.id,
      version: bill.updated_at,
      party_id: supplier,
      date: "2026-09-02",
      debit_account_id: a("purchases"),
      tax_amount: "6",
      items: bill.items,
    });
    const billJournal = (await command("post_bill", { id: bill.id })).id;
    await command("save_journal", {
      date: "2026-09-03",
      memo: "Manual cost allocation",
      post: true,
      lines: [
        { account_id: a("cogs"), debit: "40" },
        { account_id: a("purchases"), credit: "40" },
      ],
    });
    await command("save_journal", {
      date: "2026-09-03",
      memo: "Operating expense",
      post: true,
      lines: [
        { account_id: a("expenses"), debit: "10" },
        { account_id: a("cash"), credit: "10" },
      ],
    });
    const draft = (
      await command("save_journal", {
        date: "2026-09-03",
        memo: "Ignored draft",
        post: false,
        lines: [
          { account_id: a("cash"), debit: "999" },
          { account_id: a("sales"), credit: "999" },
        ],
      })
    ).id;
    const draftData = await doc("journal", draft);
    const edited = {
      id: draft,
      version: draftData.updated_at,
      date: "2026-09-03",
      memo: "Edited draft",
      post: false,
      lines: [
        { account_id: a("cash"), debit: "888" },
        { account_id: a("sales"), credit: "888" },
      ],
    };
    assert.equal((await command("save_journal", edited)).id, draft);
    assert.equal((await doc("journal", draft)).memo, "Edited draft");
    await assert.rejects(() => command("save_journal", edited), /changed/);
    await assert.rejects(
      () =>
        command("settle", {
          kind: "receipt",
          party_id: customer,
          cash_account_id: a("cash"),
          date: "2026-09-01",
          amount: "1",
        }),
      /exceeds/,
    );
    const receipt = (
      await command("settle", {
        kind: "receipt",
        party_id: customer,
        cash_account_id: a("cash"),
        target_id: inv.id,
        date: "2026-09-04",
        amount: "50",
      })
    ).id;
    await command("settle", {
      kind: "payment",
      party_id: supplier,
      cash_account_id: a("cash"),
      target_id: bill.id,
      date: "2026-09-04",
      amount: "30",
    });
    await assert.rejects(
      () =>
        command("settle", {
          kind: "receipt",
          party_id: customer,
          cash_account_id: a("cash"),
          target_id: inv.id,
          date: "2026-09-04",
          amount: "1000",
        }),
      /exceeds/,
    );
    let r = await report();
    for (const [key, val] of Object.entries({
      income: 100,
      cost_of_sales: 40,
      operating_expenses: 10,
      net_profit: 50,
      assets: 10104.59,
      liabilities: 54.59,
      total_equity: 10050,
      balance_difference: 0,
    }))
      assert.ok(new Decimal(r[key]).eq(val), `${key}: ${r[key]}`);
    assert.ok(new Decimal(r.trial_debits).eq(r.trial_credits));
    const ledger = await report(
      "2026-09-04",
      "2026-09-30",
      a("receivable"),
      customer,
      "customer",
    );
    assert.ok(new Decimal(ledger.opening).eq("118.59"));
    assert.ok(new Decimal(ledger.ledger.at(-1).running).eq("68.59"));
    assert.equal((await report("2026-10-01", "2026-10-31")).income, "0");
    await assert.rejects(
      () =>
        command("reverse", {
          id: posted,
          date: "2026-09-05",
          reason: "Correction",
        }),
      /linked/,
    );
    const receiptJournal = (
      await db.query<{ journal_id: string }>(
        "select journal_id from settlements where id=$1",
        [receipt],
      )
    ).rows[0].journal_id;
    await command("reverse", {
      id: receiptJournal,
      date: "2026-09-05",
      reason: "Wrong receipt",
    });
    await command("reverse", {
      id: posted,
      date: "2026-09-05",
      reason: "Wrong invoice",
    });
    assert.ok(new Decimal((await report()).income).eq(0));
    await assert.rejects(
      () =>
        command("reverse", { id: posted, date: "2026-09-05", reason: "Twice" }),
      /already reversed/,
    );
    await assert.rejects(
      () => db.query("update journal_lines set debit=1"),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query("select acc_account('cash')"),
      /permission denied/,
    );
    for (const table of [
      "accounts",
      "trade_orders",
      "supplier_bills",
      "settlements",
      "journals",
    ]) {
      await assert.rejects(
        () => db.query(`delete from ${table}`),
        /permission denied/,
      );
    }
    const postedBill = await doc("bill", bill.id);
    await assert.rejects(
      () =>
        command("save_bill", {
          id: bill.id,
          version: postedBill.updated_at,
          party_id: supplier,
          date: "2026-09-02",
          debit_account_id: a("purchases"),
          tax_amount: "0",
          items: postedBill.items,
        }),
      /Posted bill/,
    );
    const cancelled = (
      await command("save_order", {
        kind: "purchase",
        party_id: supplier,
        date: "2026-09-03",
        items: [line],
      })
    ).id;
    await command("order_status", { id: cancelled, status: "cancelled" });
    await assert.rejects(
      () => command("convert_order", { id: cancelled }),
      /Confirm/,
    );
    await assert.rejects(
      () =>
        command("save_account", {
          id: a("cash"),
          code: "1000",
          name: "Cash",
          category: "expense",
          active: true,
          is_cash: false,
        }),
      /classification/,
    );
    await command("lock_period", { date: "2026-09-05" });
    await assert.rejects(
      () => command("post_journal", { id: draft }),
      /locked/,
    );
    await assert.rejects(
      () =>
        command("save_journal", {
          date: "2026-09-01",
          memo: "Closed",
          post: true,
          lines: [
            { account_id: a("cash"), debit: "1" },
            { account_id: a("capital"), credit: "1" },
          ],
        }),
      /locked/,
    );
    await asUser(db, other);
    assert.equal((await db.query("select * from journals")).rows.length, 0);
    assert.equal(
      (await db.query("select * from supplier_bills")).rows.length,
      0,
    );
    await command("initialize");
    await assert.rejects(
      () => command("post_bill", { id: bill.id }),
      /not found/,
    );
    await assert.rejects(() => doc("journal", billJournal), /not found/);
    await assert.rejects(
      () =>
        command("save_journal", {
          date: "2026-09-10",
          memo: "Foreign accounts",
          post: true,
          lines: [
            { account_id: a("cash"), debit: "10" },
            { account_id: a("capital"), credit: "10" },
          ],
        }),
      /not found/,
    );
    await assert.rejects(
      () => command("save_supplier", { id: supplier, name: "Take over" }),
      /not found/,
    );
    await assert.rejects(
      () => command("convert_order", { id: order }),
      /not found/,
    );
    assert.ok(new Decimal((await report()).assets).eq(0));
    console.log(
      "PASS accounting lifecycle, exact balanced reports, corrections and tenant isolation",
    );
  } finally {
    await db.close();
  }
});
