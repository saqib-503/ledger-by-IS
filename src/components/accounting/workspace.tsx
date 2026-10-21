"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Shell } from "../shell";
import { MasterForm } from "./master-form";
import { TradeForm } from "./trade-form";
import { JournalForm } from "./journal-form";
import { SettlementForm } from "./settlement-form";
import { Reports } from "./reports";
import {
  accountingCommand,
  accountingDocument,
  today,
} from "@/lib/accounting/client";
import { money } from "@/lib/calculations";
import {
  sections,
  type Section,
  type AccountingData,
  type TradeDocument,
  type Journal,
  type Account,
} from "@/lib/accounting/types";
import type { Customer } from "@/lib/types";
export function AccountingWorkspace({ section }: { section: Section }) {
  const router = useRouter(),
    params = useSearchParams();
  const [data, setData] = useState<AccountingData>(),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [form, setForm] = useState(false),
    [master, setMaster] = useState<Account | Customer>(),
    [draftJournal, setDraftJournal] = useState<Journal>(),
    [trade, setTrade] = useState<TradeDocument>(),
    [detail, setDetail] = useState<TradeDocument | Journal>(),
    [reversal, setReversal] = useState<Journal>(),
    [reverseDate, setReverseDate] = useState(today()),
    [reason, setReason] = useState(""),
    [lockDate, setLockDate] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/accounting");
    const value = await r.json();
    if (!r.ok) throw new Error(value.error);
    setData(value as AccountingData);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    const id = params.get("view") || params.get("edit");
    if (
      !id ||
      !["bills", "sales-orders", "purchase-orders", "journals"].includes(
        section,
      )
    )
      return;
    accountingDocument<TradeDocument | Journal>(
      section === "journals"
        ? "journal"
        : section === "bills"
          ? "bill"
          : "order",
      id,
    )
      .then((d) => {
        if (params.has("edit")) {
          if (section === "journals") setDraftJournal(d as Journal);
          else setTrade(d as TradeDocument);
          setForm(true);
        } else setDetail(d);
      })
      .catch((e) => setError(e.message));
  }, [params, section]);
  async function run(action: string, input: unknown, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await accountingCommand(action, input);
      await load();
      setSuccess("Saved successfully.");
      if (action === "convert_order") {
        router.push(
          result.kind === "invoice"
            ? `/invoices/${result.id}/edit`
            : `/accounting/bills?edit=${result.id}`,
        );
      }
      if (action === "reverse") setReversal(undefined);
      return result;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saved() {
    setForm(false);
    setMaster(undefined);
    setTrade(undefined);
    setDraftJournal(undefined);
    setSuccess("Saved successfully.");
    try {
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function open(entity: string, id: string, edit = false) {
    setError("");
    try {
      const d = await accountingDocument<TradeDocument | Journal>(entity, id);
      if (edit) {
        if (entity === "journal") setDraftJournal(d as Journal);
        else setTrade(d as TradeDocument);
        setForm(true);
        setDetail(undefined);
      } else setDetail(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const isReport = [
    "ledger",
    "trial-balance",
    "profit-loss",
    "balance-sheet",
  ].includes(section);
  const title = sections[section];
  const reversed = new Set(
    data?.journals.filter((j) => j.reverses_id).map((j) => j.reverses_id),
  );
  const filtered = <T,>(rows: T[]) =>
    rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
    );
  const partyName = (id?: string | null, supplier = false) =>
    (supplier ? data?.suppliers : data?.customers)?.find((p) => p.id === id)
      ?.name || "—";
  const name =
    section === "accounts"
      ? "account"
      : section === "suppliers"
        ? "supplier"
        : ["sales-orders", "purchase-orders"].includes(section)
          ? "order"
          : section === "bills"
            ? "bill"
            : section === "receipts"
              ? "receipt"
              : section === "payments"
                ? "payment"
                : "journal";
  return (
    <Shell
      active={
        section === "sales-orders"
          ? "Sales Orders"
          : section === "purchase-orders"
            ? "Purchase Orders"
            : section === "suppliers"
              ? "Suppliers"
              : isReport
                ? "Reports"
                : "Accounting"
      }
      email={data?.email}
    >
      <nav className="accounting-tabs no-print">
        {Object.entries(sections).map(([key, label]) => (
          <Link
            className={section === key ? "selected" : ""}
            href={"/accounting/" + key}
            key={key}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ORDERS & ACCOUNTING</span>
          <h1>{title}</h1>
          <p>
            {isReport
              ? "Based on posted journal entries."
              : section.includes("orders")
                ? "Confirm an order, then convert it to a draft invoice or supplier bill."
                : "Accurate records, from the first entry to the final balance."}
          </p>
        </div>
        {data?.config && !isReport && !form && (
          <button
            className="primary no-print"
            onClick={() => {
              setMaster(undefined);
              setTrade(undefined);
              setDraftJournal(undefined);
              setForm(true);
              setDetail(undefined);
            }}
          >
            <Plus size={16} /> New {name}
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
          {!data && (
            <p>
              For the first run, apply the orders/accounting migration after the
              original migration.
            </p>
          )}
        </div>
      )}
      {success && (
        <p className="success no-print" role="status">
          {success}
        </p>
      )}
      {!data && !error ? (
        <div className="loading">Loading accounting workspace…</div>
      ) : data && !data.config ? (
        <section className="panel padded">
          <h2>Set up your chart of accounts</h2>
          <p>
            Create default cash/bank, receivable/payable, capital, tax clearing,
            sales and expense accounts. Existing invoices are not posted
            automatically.
          </p>
          <p className="notice">
            Review opening balances and tax clearing classifications before
            posting. Post older invoices only if they are not already included
            in opening balances.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => run("initialize", {})}
          >
            {busy ? "Setting up…" : "Initialize accounting"}
          </button>
        </section>
      ) : (
        data && (
          <>
            {form ? (
              section === "accounts" || section === "suppliers" ? (
                <MasterForm
                  key={master?.id || "new"}
                  kind={section === "accounts" ? "account" : "supplier"}
                  initial={master}
                  onDone={saved}
                  onCancel={() => setForm(false)}
                />
              ) : ["sales-orders", "purchase-orders", "bills"].includes(
                  section,
                ) ? (
                <TradeForm
                  key={trade?.id || "new"}
                  mode={
                    section === "sales-orders"
                      ? "sales"
                      : section === "purchase-orders"
                        ? "purchase"
                        : "bill"
                  }
                  data={data}
                  initial={trade}
                  onDone={saved}
                  onCancel={() => setForm(false)}
                />
              ) : section === "receipts" || section === "payments" ? (
                <SettlementForm
                  kind={section === "receipts" ? "receipt" : "payment"}
                  data={data}
                  onDone={saved}
                  onCancel={() => setForm(false)}
                />
              ) : (
                <JournalForm
                  data={data}
                  initial={draftJournal}
                  opening={
                    section === "opening-balances" ||
                    draftJournal?.source_type === "opening"
                  }
                  onDone={saved}
                  onCancel={() => setForm(false)}
                />
              )
            ) : isReport ? (
              <Reports section={section} data={data} />
            ) : (
              <>
                {reversal && (
                  <form
                    className="panel padded no-print"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(
                        "reverse",
                        { id: reversal.id, date: reverseDate, reason },
                        "Post a reversing journal? The original entry remains in the audit history.",
                      );
                    }}
                  >
                    <h2>Reverse {reversal.number}</h2>
                    <div className="form-grid">
                      <label>
                        Reversal date
                        <input
                          type="date"
                          min={reversal.date}
                          required
                          value={reverseDate}
                          onChange={(e) => setReverseDate(e.target.value)}
                        />
                      </label>
                      <label>
                        Reason
                        <input
                          required
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReversal(undefined)}
                    >
                      Cancel
                    </button>{" "}
                    <button className="primary" disabled={busy}>
                      Post reversal
                    </button>
                  </form>
                )}
                {detail && (
                  <section className="panel padded document-detail">
                    <div className="form-actions no-print">
                      <button onClick={() => window.print()}>
                        Print document
                      </button>
                      <button onClick={() => setDetail(undefined)}>
                        Close detail
                      </button>
                    </div>
                    <h2>{detail.number}</h2>
                    <p>
                      {detail.date} ·{" "}
                      {"memo" in detail
                        ? detail.memo
                        : detail.party_snapshot?.name ||
                          detail.supplier_snapshot?.name}
                    </p>
                    {"memo" in detail ? (
                      <div className="table-scroll">
                        <table className="records">
                          <thead>
                            <tr>
                              <th>Account</th>
                              <th>Party</th>
                              <th>Description</th>
                              <th>Debit</th>
                              <th>Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.items?.map((l, i) => (
                              <tr key={i}>
                                <td>
                                  {l.account_code} · {l.account_name}
                                </td>
                                <td>
                                  {l.customer_id
                                    ? partyName(l.customer_id)
                                    : l.supplier_id
                                      ? partyName(l.supplier_id, true)
                                      : "—"}
                                </td>
                                <td>{l.description}</td>
                                <td>{money(l.debit)}</td>
                                <td>{money(l.credit)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <>
                        <p className="pre-line">
                          {detail.party_snapshot?.address ||
                            detail.supplier_snapshot?.address}
                        </p>
                        {detail.due_date && <p>Due: {detail.due_date}</p>}
                        <div className="table-scroll">
                          <table className="records">
                            <thead>
                              <tr>
                                <th>Description</th>
                                <th>HS code</th>
                                <th>Quantity</th>
                                <th>Rate</th>
                                <th>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.items?.map((l, i) => (
                                <tr key={i}>
                                  <td>{l.description}</td>
                                  <td>{l.hs_code}</td>
                                  <td>{l.quantity}</td>
                                  <td>{money(l.rate)}</td>
                                  <td>{money(l.amount || "0")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {detail.tax_amount && (
                          <p>Recoverable tax: {money(detail.tax_amount)}</p>
                        )}
                        <p className="report-line">
                          <strong>Total</strong>
                          <strong>PKR {money(detail.total)}</strong>
                        </p>
                        <p className="pre-line">{detail.notes}</p>
                      </>
                    )}
                  </section>
                )}
                <div className="search no-print">
                  <Search size={17} />
                  <input
                    aria-label="Search records"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search records…"
                  />
                </div>
                <section className="panel accounting-list">
                  <div className="table-scroll">
                    <table className="records">
                      {section === "accounts" ? (
                        <>
                          <thead>
                            <tr>
                              <th>Code</th>
                              <th>Name</th>
                              <th>Category</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered(data.accounts).map((a) => (
                              <tr key={a.id}>
                                <td>{a.code}</td>
                                <td>
                                  {a.name}
                                  {a.system_key && (
                                    <small>System account</small>
                                  )}
                                </td>
                                <td>
                                  {a.category}
                                  {a.is_cash ? " · Cash/bank" : ""}
                                </td>
                                <td>{a.active ? "Active" : "Inactive"}</td>
                                <td>
                                  <button
                                    onClick={() => {
                                      setMaster(a);
                                      setForm(true);
                                    }}
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      ) : section === "suppliers" ? (
                        <>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Address / tax IDs</th>
                              <th>Contact</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered(data.suppliers).map((s) => (
                              <tr key={s.id}>
                                <td>
                                  {s.name}
                                  {s.archived && <small>Archived</small>}
                                </td>
                                <td>
                                  {s.address}
                                  <small>
                                    NTN {s.ntn} · STRN {s.strn}
                                  </small>
                                </td>
                                <td>
                                  {s.phone}
                                  <small>{s.email}</small>
                                </td>
                                <td>
                                  <button
                                    onClick={() => {
                                      setMaster(s);
                                      setForm(true);
                                    }}
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      ) : ["sales-orders", "purchase-orders", "bills"].includes(
                          section,
                        ) ? (
                        <>
                          <thead>
                            <tr>
                              <th>Number</th>
                              <th>Party</th>
                              <th>Date</th>
                              <th>Total</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered(
                              section === "bills"
                                ? data.bills
                                : data.orders.filter(
                                    (o) =>
                                      o.kind ===
                                      (section === "sales-orders"
                                        ? "sales"
                                        : "purchase"),
                                  ),
                            ).map((d) => (
                              <tr key={d.id}>
                                <td>{d.number}</td>
                                <td>
                                  {d.party_snapshot?.name ||
                                    d.supplier_snapshot?.name}
                                </td>
                                <td>{d.date}</td>
                                <td className="numeric">{money(d.total)}</td>
                                <td>
                                  {section === "bills"
                                    ? d.journal_id
                                      ? reversed.has(d.journal_id)
                                        ? "Reversed"
                                        : "Posted"
                                      : "Draft"
                                    : d.status}
                                </td>
                                <td>
                                  <div className="actions">
                                    <button
                                      onClick={() =>
                                        open(
                                          section === "bills"
                                            ? "bill"
                                            : "order",
                                          d.id,
                                        )
                                      }
                                    >
                                      View
                                    </button>
                                    {!d.journal_id &&
                                      (section === "bills" ||
                                        d.status === "draft") && (
                                        <button
                                          onClick={() =>
                                            open(
                                              section === "bills"
                                                ? "bill"
                                                : "order",
                                              d.id,
                                              true,
                                            )
                                          }
                                        >
                                          Edit
                                        </button>
                                      )}
                                    {section === "bills" ? (
                                      !d.journal_id ? (
                                        <button
                                          disabled={busy}
                                          onClick={() =>
                                            run(
                                              "post_bill",
                                              { id: d.id },
                                              "Post this supplier bill to the ledger?",
                                            )
                                          }
                                        >
                                          Post bill
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() =>
                                            open("journal", d.journal_id!)
                                          }
                                        >
                                          View journal
                                        </button>
                                      )
                                    ) : (
                                      <>
                                        {d.status === "draft" && (
                                          <button
                                            disabled={busy}
                                            onClick={() =>
                                              run(
                                                "order_status",
                                                {
                                                  id: d.id,
                                                  status: "confirmed",
                                                },
                                                "Confirm this order? It will become read-only.",
                                              )
                                            }
                                          >
                                            Confirm
                                          </button>
                                        )}
                                        {["draft", "confirmed"].includes(
                                          d.status || "",
                                        ) && (
                                          <button
                                            disabled={busy}
                                            onClick={() =>
                                              run(
                                                "order_status",
                                                {
                                                  id: d.id,
                                                  status: "cancelled",
                                                },
                                                "Cancel this order?",
                                              )
                                            }
                                          >
                                            Cancel
                                          </button>
                                        )}
                                        {d.status === "confirmed" && (
                                          <button
                                            disabled={busy}
                                            onClick={() =>
                                              run("convert_order", { id: d.id })
                                            }
                                          >
                                            Convert to{" "}
                                            {d.kind === "sales"
                                              ? "Invoice"
                                              : "Bill"}
                                          </button>
                                        )}
                                        {d.invoice_id && (
                                          <Link
                                            href={`/invoices/${d.invoice_id}`}
                                          >
                                            Open invoice
                                          </Link>
                                        )}
                                        {d.bill_id && (
                                          <Link
                                            href={`/accounting/bills?view=${d.bill_id}`}
                                          >
                                            Open bill
                                          </Link>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      ) : ["receipts", "payments"].includes(section) ? (
                        <>
                          <thead>
                            <tr>
                              <th>Number</th>
                              <th>Party</th>
                              <th>Date</th>
                              <th>Amount</th>
                              <th>Reference / status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered(
                              data.settlements.filter(
                                (s) =>
                                  s.kind ===
                                  (section === "receipts"
                                    ? "receipt"
                                    : "payment"),
                              ),
                            ).map((s) => (
                              <tr key={s.id}>
                                <td>{s.number}</td>
                                <td>
                                  {partyName(
                                    s.customer_id || s.supplier_id,
                                    s.kind === "payment",
                                  )}
                                </td>
                                <td>{s.date}</td>
                                <td>{money(s.amount)}</td>
                                <td>
                                  {s.reference}
                                  <small>
                                    {reversed.has(s.journal_id)
                                      ? "Reversed"
                                      : "Posted"}
                                  </small>
                                </td>
                                <td>
                                  <button
                                    onClick={() =>
                                      open("journal", s.journal_id)
                                    }
                                  >
                                    View journal
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      ) : (
                        <>
                          <thead>
                            <tr>
                              <th>Number</th>
                              <th>Date</th>
                              <th>Memo / source</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered(
                              data.journals.filter(
                                (j) =>
                                  section !== "opening-balances" ||
                                  j.source_type === "opening",
                              ),
                            ).map((j) => (
                              <tr key={j.id}>
                                <td>{j.number}</td>
                                <td>{j.date}</td>
                                <td>
                                  {j.memo}
                                  <small>{j.source_type}</small>
                                </td>
                                <td>
                                  {reversed.has(j.id) ? "Reversed" : j.status}
                                </td>
                                <td>
                                  <div className="actions">
                                    <button
                                      onClick={() => open("journal", j.id)}
                                    >
                                      View
                                    </button>
                                    {j.status === "draft" && (
                                      <button
                                        onClick={() =>
                                          open("journal", j.id, true)
                                        }
                                      >
                                        Edit
                                      </button>
                                    )}
                                    {j.status === "draft" && (
                                      <button
                                        disabled={busy}
                                        onClick={() =>
                                          run(
                                            "post_journal",
                                            { id: j.id },
                                            "Post this journal to the ledger?",
                                          )
                                        }
                                      >
                                        Post
                                      </button>
                                    )}
                                    {j.status === "posted" &&
                                      !j.reverses_id &&
                                      !reversed.has(j.id) && (
                                        <button
                                          onClick={() => {
                                            setReversal(j);
                                            setReason("");
                                            setReverseDate(today());
                                          }}
                                        >
                                          Reverse
                                        </button>
                                      )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      )}
                    </table>
                  </div>
                </section>
                {section === "journals" && (
                  <section className="panel padded no-print">
                    <h2>Close an accounting period</h2>
                    <p>
                      Posting is locked through:{" "}
                      <strong>
                        {data.config?.locked_through || "No locked period"}
                      </strong>
                      . Closing a period prevents new or backdated postings
                      through that date.
                    </p>
                    <form
                      className="filters"
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(
                          "lock_period",
                          { date: lockDate },
                          "Lock this period? The app cannot reopen a closed period.",
                        );
                      }}
                    >
                      <label>
                        Close through
                        <input
                          type="date"
                          max={today()}
                          required
                          value={lockDate}
                          onChange={(e) => setLockDate(e.target.value)}
                        />
                      </label>
                      <button disabled={busy}>Lock period</button>
                    </form>
                  </section>
                )}
              </>
            )}
          </>
        )
      )}
    </Shell>
  );
}
