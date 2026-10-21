"use client";
import { useState } from "react";
import { accountingCommand, today } from "@/lib/accounting/client";
import { calculate, money } from "@/lib/calculations";
import Decimal from "decimal.js";
import type { AccountingData, TradeDocument } from "@/lib/accounting/types";
import type { Item } from "@/lib/types";
export function TradeForm({
  mode,
  data,
  initial,
  onDone,
  onCancel,
}: {
  mode: "sales" | "purchase" | "bill";
  data: AccountingData;
  initial?: TradeDocument;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [party, setParty] = useState(
    initial?.customer_id || initial?.supplier_id || "",
  );
  const [date, setDate] = useState(initial?.date || today());
  const [due, setDue] = useState(initial?.due_date || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [reference, setReference] = useState(initial?.reference || "");
  const [account, setAccount] = useState(
    initial?.debit_account_id ||
      data.accounts.find((a) => a.system_key === "purchases")?.id ||
      "",
  );
  const [tax, setTax] = useState(initial?.tax_amount || "0");
  const [items, setItems] = useState<Item[]>(
    initial?.items || [
      { description: "", quantity: "1", rate: "0", hs_code: "" },
    ],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const parties = mode === "sales" ? data.customers : data.suppliers;
  const total = new Decimal(calculate(items, "0", "0").subtotal)
    .plus(mode === "bill" ? tax || 0 : 0)
    .toFixed();
  function update(index: number, key: keyof Item, value: string) {
    setItems(items.map((i, n) => (n === index ? { ...i, [key]: value } : i)));
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await accountingCommand(
            mode === "bill" ? "save_bill" : "save_order",
            {
              id: initial?.id,
              version: initial?.updated_at,
              kind: mode,
              party_id: party,
              date,
              due_date: due,
              notes,
              reference,
              debit_account_id: account,
              tax_amount: tax,
              items,
            },
          );
          onDone();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <section className="panel padded">
        <h2>
          {initial
            ? `Edit ${initial.number}`
            : mode === "bill"
              ? "New supplier bill"
              : `New ${mode} order`}
        </h2>
        <div className="form-grid">
          <label>
            {mode === "sales" ? "Customer" : "Supplier"}
            <select
              aria-label={mode === "sales" ? "Customer" : "Supplier"}
              required
              value={party}
              onChange={(e) => setParty(e.target.value)}
            >
              <option value="">
                Select {mode === "sales" ? "customer" : "supplier"}
              </option>
              {parties
                .filter((p) => !p.archived)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
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
            Due date
            <input
              type="date"
              min={date}
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          {mode === "bill" && (
            <>
              <label>
                Supplier reference
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
              <label>
                Debit account
                <select
                  aria-label="Debit account"
                  required
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                >
                  {data.accounts
                    .filter(
                      (a) =>
                        a.active &&
                        ["asset", "expense"].includes(a.category) &&
                        !a.is_cash &&
                        !["receivable", "purchase_tax"].includes(
                          a.system_key || "",
                        ),
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Recoverable purchase tax (amount)
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  required
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                />
              </label>
            </>
          )}
        </div>
        {mode === "bill" && (
          <p className="notice">
            For goods whose cost will be recognized later, use Purchases
            awaiting cost allocation. Record cost of goods sold with a manual
            journal when appropriate. Enter only recoverable tax in the tax
            field; include non-recoverable tax in item cost.
          </p>
        )}
      </section>
      <section className="panel padded">
        <h2>Items</h2>
        <div className="table-scroll">
          <table className="item-table">
            <thead>
              <tr>
                <th>Description</th>
                {mode === "sales" && <th>HS code</th>}
                <th>Quantity</th>
                <th>Rate</th>
                <th>Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <input
                      aria-label={`Description ${index + 1}`}
                      required
                      value={item.description}
                      onChange={(e) =>
                        update(index, "description", e.target.value)
                      }
                    />
                  </td>
                  {mode === "sales" && (
                    <td>
                      <input
                        aria-label={`HS code ${index + 1}`}
                        value={item.hs_code}
                        onChange={(e) =>
                          update(index, "hs_code", e.target.value)
                        }
                      />
                    </td>
                  )}
                  <td>
                    <input
                      aria-label={`Quantity ${index + 1}`}
                      type="number"
                      required
                      min="0.0001"
                      max="1000000000"
                      step="0.0001"
                      value={item.quantity}
                      onChange={(e) =>
                        update(index, "quantity", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Rate ${index + 1}`}
                      type="number"
                      required
                      min="0"
                      max="1000000000"
                      step="0.0001"
                      value={item.rate}
                      onChange={(e) => update(index, "rate", e.target.value)}
                    />
                  </td>
                  <td>{money(calculate([item], "0", "0").subtotal)}</td>
                  <td>
                    <button
                      aria-label={`Remove item ${index + 1}`}
                      type="button"
                      disabled={items.length === 1}
                      onClick={() =>
                        setItems(items.filter((_, n) => n !== index))
                      }
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          className="add-item"
          type="button"
          onClick={() =>
            setItems([
              ...items,
              { description: "", quantity: "1", rate: "0", hs_code: "" },
            ])
          }
        >
          + Add item
        </button>
        <div className="totals">
          <div className="grand-total">
            <span>Total</span>
            <strong>PKR {money(total)}</strong>
          </div>
        </div>
      </section>
      <section className="panel padded">
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </section>
      <div className="sticky-actions">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save draft"}
        </button>
      </div>
    </form>
  );
}
