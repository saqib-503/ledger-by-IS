"use client";
import { useState } from "react";
import Decimal from "decimal.js";
import { accountingCommand, today } from "@/lib/accounting/client";
import { money } from "@/lib/calculations";
import type {
  AccountingData,
  JournalLine,
  Journal,
} from "@/lib/accounting/types";
const blank: JournalLine = {
  account_id: "",
  debit: "0",
  credit: "0",
  description: "",
  customer_id: "",
  supplier_id: "",
};
export function JournalForm({
  data,
  opening = false,
  initial,
  onDone,
  onCancel,
}: {
  data: AccountingData;
  opening?: boolean;
  initial?: Journal;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initial?.date || today()),
    [memo, setMemo] = useState(initial?.memo || "");
  const [lines, setLines] = useState<JournalLine[]>(
    initial?.items || [{ ...blank }, { ...blank }],
  );
  const [post, setPost] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const accounts = data.accounts.filter(
    (a) =>
      a.active && (!opening || !["income", "expense"].includes(a.category)),
  );
  const debit = lines.reduce((s, l) => s.plus(l.debit || 0), new Decimal(0)),
    credit = lines.reduce((s, l) => s.plus(l.credit || 0), new Decimal(0));
  function update(index: number, patch: Partial<JournalLine>) {
    setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          post &&
          !confirm(
            "Post this balanced journal? Posted entries can only be corrected with a reversal.",
          )
        )
          return;
        setBusy(true);
        setError("");
        try {
          await accountingCommand("save_journal", {
            id: initial?.id,
            version: initial?.updated_at,
            date,
            memo,
            source_type:
              initial?.source_type || (opening ? "opening" : "manual"),
            post,
            lines,
          });
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
            : opening
              ? "Enter opening balances"
              : "New journal entry"}
        </h2>
        <p className="notice">
          {opening
            ? "Use balance-sheet accounts. Tag receivable/payable lines to the relevant customer/supplier. Balance against owner capital, retained earnings, or opening equity as appropriate."
            : "Every entry needs equal debits and credits. To recognize the cost of goods sold, debit Cost of goods sold and credit Purchases awaiting cost allocation."}
        </p>
        <div className="form-grid">
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
            Memo
            <input
              required
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>
        </div>
        <div className="table-scroll">
          <table className="item-table">
            <thead>
              <tr>
                <th>Account / party</th>
                <th>Description</th>
                <th>Debit</th>
                <th>Credit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const account = accounts.find((a) => a.id === line.account_id);
                const customer = account?.system_key === "receivable",
                  supplier = account?.system_key === "payable";
                return (
                  <tr key={index}>
                    <td>
                      <select
                        aria-label={`Account ${index + 1}`}
                        required
                        value={line.account_id}
                        onChange={(e) =>
                          update(index, {
                            account_id: e.target.value,
                            customer_id: "",
                            supplier_id: "",
                          })
                        }
                      >
                        <option value="">Select account</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} · {a.name}
                          </option>
                        ))}
                      </select>
                      {(customer || supplier) && (
                        <select
                          aria-label={`Party ${index + 1}`}
                          required
                          value={
                            (customer ? line.customer_id : line.supplier_id) ||
                            ""
                          }
                          onChange={(e) =>
                            update(
                              index,
                              customer
                                ? { customer_id: e.target.value }
                                : { supplier_id: e.target.value },
                            )
                          }
                        >
                          <option value="">
                            Select {customer ? "customer" : "supplier"}
                          </option>
                          {(customer ? data.customers : data.suppliers).map(
                            (p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ),
                          )}
                        </select>
                      )}
                    </td>
                    <td>
                      <input
                        aria-label={`Line description ${index + 1}`}
                        value={line.description || ""}
                        onChange={(e) =>
                          update(index, { description: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Debit ${index + 1}`}
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={line.debit}
                        onChange={(e) =>
                          update(index, { debit: e.target.value || "0" })
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Credit ${index + 1}`}
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={line.credit}
                        onChange={(e) =>
                          update(index, { credit: e.target.value || "0" })
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-label={`Remove line ${index + 1}`}
                        disabled={lines.length === 2}
                        onClick={() =>
                          setLines(lines.filter((_, n) => n !== index))
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="add-item"
          onClick={() => setLines([...lines, { ...blank }])}
        >
          + Add line
        </button>
        <div className="journal-balance">
          <span>
            Debit: <strong>{money(debit.toFixed())}</strong>
          </span>
          <span>
            Credit: <strong>{money(credit.toFixed())}</strong>
          </span>
          <span className={debit.eq(credit) ? "success" : "error"}>
            {debit.eq(credit)
              ? "Balanced"
              : `Difference: ${debit.minus(credit).toFixed()}`}
          </span>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={post}
            onChange={(e) => setPost(e.target.checked)}
          />{" "}
          Post immediately
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
        <button
          className="primary"
          disabled={busy || !debit.eq(credit) || debit.isZero()}
        >
          {busy ? "Saving…" : post ? "Post journal" : "Save journal draft"}
        </button>
      </div>
    </form>
  );
}
