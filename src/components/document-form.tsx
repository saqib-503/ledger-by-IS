"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { calculate, money, wholeMoney } from "@/lib/calculations";
import type { Kind, Document, Item } from "@/lib/types";
import type { WorkspaceData } from "./workspace";
import { RecordForm } from "./record-form";
const blank: Item = { description: "", hs_code: "", quantity: "1", rate: "0" };
export function DocumentForm({
  kind,
  doc,
  data,
  reload,
}: {
  kind: Kind;
  doc?: Document;
  data: WorkspaceData;
  reload: () => void;
}) {
  if (doc?.accounting_journal_id)
    return (
      <div className="notice">
        This invoice has been posted to accounting and is read-only. Reverse its
        journal and duplicate the invoice to make a correction.{" "}
        <a href={`/accounting/journals?view=${doc.accounting_journal_id}`}>
          View journal
        </a>
      </div>
    );
  if (!data.settings)
    return (
      <div className="notice">
        Please <a href="/settings">save company settings</a> before creating a
        document.
      </div>
    );
  if (!doc && location.pathname.endsWith("/edit"))
    return <div>Loading document…</div>;
  return (
    <Editor
      key={doc?.id || "new"}
      kind={kind}
      doc={doc}
      data={data}
      reload={reload}
    />
  );
}
function Editor({
  kind,
  doc,
  data,
  reload,
}: {
  kind: Kind;
  doc?: Document;
  data: WorkspaceData;
  reload: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(doc?.items || [{ ...blank }]);
  const [customerId, setCustomerId] = useState(doc?.customer_id || "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [addCustomer, setAddCustomer] = useState(false);
  const [date, setDate] = useState(
    doc?.date || new Date().toLocaleDateString("en-CA"),
  );
  const [status, setStatus] = useState(doc?.status || "draft");
  const [sales, setSales] = useState(
    String(doc?.sales_tax_rate ?? data.settings?.sales_tax_rate ?? 18),
  );
  const [advance, setAdvance] = useState(
    String(doc?.advance_tax_rate ?? data.settings?.advance_tax_rate ?? 0.5),
  );
  const [notes, setNotes] = useState(doc?.notes || "");
  const [declaration, setDeclaration] = useState(
    doc?.declaration ?? data.settings?.declaration ?? "",
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const customer =
    doc?.customer_id === customerId
      ? doc.customer_snapshot
      : data.customers.find((c) => c.id === customerId);
  let totals;
  try {
    totals = calculate(
      items,
      kind === "invoice" ? sales : "0",
      kind === "invoice" ? advance : "0",
    );
  } catch {
    totals = calculate([], "0", "0");
  }
  function update(index: number, key: keyof Item, value: string) {
    setItems(items.map((i, n) => (n === index ? { ...i, [key]: value } : i)));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {doc ? "UPDATE DOCUMENT" : "A NEW BEGINNING"}
          </span>
          <h1>{doc ? doc.number : `New ${kind}`}</h1>
          <p>
            {doc
              ? "Update the details below."
              : "A document number is assigned securely when you save."}
          </p>
        </div>
      </div>
      {addCustomer && (
        <RecordForm
          entity="customer"
          initial={null}
          onCancel={() => setAddCustomer(false)}
          onSaved={(c) => {
            setCustomerId(c.id);
            setAddCustomer(false);
            reload();
          }}
        />
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await api({
              kind,
              id: doc?.id,
              version: doc?.updated_at,
              data: {
                customer_id: customerId,
                date,
                status,
                sales_tax_rate: kind === "invoice" ? sales : "0",
                advance_tax_rate: kind === "invoice" ? advance : "0",
                notes,
                declaration,
                items,
              },
            });
            router.push(`/${kind}s/${result.id}`);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <section className="panel padded">
          <h2>Document details</h2>
          <div className="form-grid">
            <label>
              Document number
              <input readOnly value={doc?.number || "Assigned on save"} />
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
              Status
              <select
                aria-label="Status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "draft" | "issued")
                }
              >
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
              </select>
            </label>
            <label>
              Find customer
              <input
                type="search"
                placeholder="Search name or NTN…"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
              />
            </label>
            <label className="wide">
              Customer
              <select
                aria-label="Customer"
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select a customer</option>
                {data.customers
                  .filter(
                    (c) =>
                      !c.archived &&
                      (c.id === customerId ||
                        [c.name, c.ntn]
                          .join(" ")
                          .toLowerCase()
                          .includes(customerQuery.toLowerCase())),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.ntn ? " · " + c.ntn : ""}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="text-link"
            onClick={() => setAddCustomer(true)}
          >
            <Plus size={15} /> Create a customer here
          </button>
          {customer && (
            <div className="customer-summary">
              <strong>{customer.name}</strong>
              <p>{customer.address}</p>
              <small>
                NTN: {customer.ntn || "—"} · STRN: {customer.strn || "—"} ·{" "}
                {customer.phone}
              </small>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Line items</h2>
            <span className="muted">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="table-scroll">
            <table className="item-table">
              <thead>
                <tr>
                  <th>DESCRIPTION</th>
                  {kind === "invoice" && <th>HS CODE</th>}
                  <th>QUANTITY</th>
                  <th>{kind === "invoice" ? "AVG RATE" : "RATE"}</th>
                  {kind === "invoice" && <th>AMOUNT</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <textarea
                        aria-label={`Description ${index + 1}`}
                        required
                        value={item.description}
                        onChange={(e) =>
                          update(index, "description", e.target.value)
                        }
                        placeholder="Describe the item"
                      />
                    </td>
                    {kind === "invoice" && (
                      <td>
                        <input
                          aria-label={`HS code ${index + 1}`}
                          value={item.hs_code}
                          onChange={(e) =>
                            update(index, "hs_code", e.target.value)
                          }
                          placeholder="6109.1000"
                        />
                      </td>
                    )}
                    <td>
                      <input
                        aria-label={`Quantity ${index + 1}`}
                        type="number"
                        min="0.0001"
                        max="1000000000"
                        step="0.0001"
                        required
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
                        min="0"
                        max="1000000000"
                        step="0.0001"
                        required
                        value={item.rate}
                        onChange={(e) => update(index, "rate", e.target.value)}
                      />
                    </td>
                    {kind === "invoice" && (
                      <td className="numeric">
                        {money(calculate([item], "0", "0").subtotal)}
                      </td>
                    )}
                    <td>
                      <button
                        type="button"
                        aria-label={`Remove item ${index + 1}`}
                        disabled={items.length === 1}
                        onClick={() =>
                          setItems(items.filter((_, n) => n !== index))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="add-item"
            onClick={() => setItems([...items, { ...blank }])}
          >
            <Plus size={16} /> Add item
          </button>
        </section>
        <section className="panel padded">
          <div className="form-grid">
            <label className="wide">
              Notes
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            {kind === "quotation" ? (
              <label className="wide">
                Declaration / terms
                <textarea
                  rows={5}
                  value={declaration}
                  onChange={(e) => setDeclaration(e.target.value)}
                />
              </label>
            ) : (
              <>
                <label>
                  Sales tax (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.0001"
                    value={sales}
                    onChange={(e) => setSales(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Advance tax (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.0001"
                    value={advance}
                    onChange={(e) => setAdvance(e.target.value)}
                    required
                  />
                </label>
              </>
            )}
          </div>
          {kind === "invoice" && (
            <div className="totals">
              <small className="muted">
                Totals display in whole PKR, as in your template. Calculations
                retain full precision.
              </small>
              {Object.entries(totals).map(([key, value]) => (
                <div
                  key={key}
                  className={key === "grand_total" ? "grand-total" : ""}
                >
                  <span>{key.replaceAll("_", " ")}</span>
                  <strong>PKR {wholeMoney(value)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
        <div className="sticky-actions">
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <span className="muted">Saved to your secure workspace</span>
          <button className="primary" disabled={busy || doc?.archived}>
            {busy ? "Saving…" : `Save ${kind}`}
          </button>
        </div>
      </form>
    </>
  );
}
