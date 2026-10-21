"use client";
import { useState } from "react";
import Decimal from "decimal.js";
import { accountingCommand, today } from "@/lib/accounting/client";
import { money } from "@/lib/calculations";
import type { AccountingData } from "@/lib/accounting/types";
export function SettlementForm({
  kind,
  data,
  onDone,
  onCancel,
}: {
  kind: "receipt" | "payment";
  data: AccountingData;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [party, setParty] = useState(""),
    [target, setTarget] = useState(""),
    [cash, setCash] = useState(""),
    [date, setDate] = useState(today()),
    [amount, setAmount] = useState(""),
    [reference, setReference] = useState(""),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const reversed = new Set(
    data.journals.filter((j) => j.reverses_id).map((j) => j.reverses_id),
  );
  const targets = (
    kind === "receipt"
      ? data.invoices
          .filter(
            (i) =>
              i.customer_id === party &&
              i.accounting_journal_id &&
              !reversed.has(i.accounting_journal_id),
          )
          .map((i) => ({ id: i.id, number: i.number, total: i.grand_total }))
      : data.bills
          .filter(
            (b) =>
              b.supplier_id === party &&
              b.journal_id &&
              !reversed.has(b.journal_id),
          )
          .map((b) => ({ id: b.id, number: b.number, total: b.total }))
  ).map((d) => ({
    ...d,
    outstanding: data.settlements
      .filter(
        (s) =>
          (kind === "receipt" ? s.invoice_id : s.bill_id) === d.id &&
          !reversed.has(s.journal_id),
      )
      .reduce((sum, s) => sum.minus(s.amount), new Decimal(d.total))
      .toFixed(),
  }));
  return (
    <form
      className="panel padded"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!confirm(`Post this ${kind}? This updates the ledger immediately.`))
          return;
        setBusy(true);
        setError("");
        try {
          await accountingCommand("settle", {
            kind,
            party_id: party,
            target_id: target,
            cash_account_id: cash,
            date,
            amount,
            reference,
            notes,
          });
          onDone();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>
        New {kind === "receipt" ? "customer receipt" : "supplier payment"}
      </h2>
      <p className="notice">
        Select a posted document to allocate a partial or full payment.
        On-account entries settle an existing party balance, including opening
        balances. Customer/supplier advances are not recorded through this form.
      </p>
      <div className="form-grid">
        <label>
          {kind === "receipt" ? "Customer" : "Supplier"}
          <select
            aria-label="Party"
            required
            value={party}
            onChange={(e) => {
              setParty(e.target.value);
              setTarget("");
            }}
          >
            <option value="">Select party</option>
            {(kind === "receipt" ? data.customers : data.suppliers).map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Allocate to
          <select
            aria-label="Allocate to"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">On account / opening balance</option>
            {targets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.number} · Outstanding {money(d.outstanding)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cash / bank
          <select
            aria-label="Cash / bank"
            required
            value={cash}
            onChange={(e) => setCash(e.target.value)}
          >
            <option value="">Select account</option>
            {data.accounts
              .filter((a) => a.is_cash && a.active)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Date
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Amount
          <input
            type="number"
            min="0.00000001"
            step="any"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Reference
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <label className="wide">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary" disabled={busy}>
          {busy ? "Posting…" : `Post ${kind}`}
        </button>
      </div>
    </form>
  );
}
