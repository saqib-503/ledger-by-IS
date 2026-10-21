"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Files,
  Users,
  ArrowUpRight,
  Plus,
  Search,
  ArrowRight,
  FolderOpen,
} from "lucide-react";
import { Shell } from "./shell";
import { DocumentActions } from "./document-actions";
import { RecordForm } from "./record-form";
import { DocumentForm } from "./document-form";
import { wholeMoney as money } from "@/lib/calculations";
import type { Customer, Company, Document, Kind } from "@/lib/types";
export interface WorkspaceData {
  customers: Customer[];
  settings: Company | null;
  invoices: Document[];
  quotations: Document[];
  email: string;
}
export function Workspace({
  page = "Dashboard",
  kind,
  id,
  edit = false,
}: {
  page?: string;
  kind?: Kind;
  id?: string;
  edit?: boolean;
}) {
  const [data, setData] = useState<WorkspaceData>();
  const [doc, setDoc] = useState<Document>();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [archived, setArchived] = useState(false);
  const [customer, setCustomer] = useState<Customer | null | undefined>();
  const [customerView, setCustomerView] = useState<Customer>();
  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/data");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
      if (kind && id && id !== "new") {
        const dr = await fetch(`/api/data?kind=${kind}&id=${id}`);
        const dd = await dr.json();
        if (!dr.ok) throw new Error(dd.error);
        setDoc(dd);
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [kind, id]);
  useEffect(() => {
    reload();
  }, [reload]);
  const invoices = data?.invoices.filter((d) => !d.archived) || [],
    quotations = data?.quotations.filter((d) => !d.archived) || [];
  function matches(d: Document) {
    if (d.archived !== archived) return false;
    const text = [
      d.number,
      d.customer_snapshot.name,
      d.customer_snapshot.ntn,
      d.date,
    ]
      .join(" ")
      .toLowerCase();
    if (!text.includes(query.toLowerCase())) return false;
    const today = new Date();
    const local = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    if (range === "today") return d.date === local;
    if (range === "month") return d.date.slice(0, 7) === local.slice(0, 7);
    if (range === "year") return d.date.slice(0, 4) === local.slice(0, 4);
    if (range === "custom")
      return (!from || d.date >= from) && (!to || d.date <= to);
    return true;
  }
  function table(rows: Document[], k: Kind, compact = false) {
    return (
      <div className="table-scroll">
        <table className="records">
          <thead>
            <tr>
              <th>DOCUMENT</th>
              <th>CUSTOMER</th>
              <th>DATE</th>
              {k === "invoice" && <th className="numeric">AMOUNT</th>}
              <th>STATUS</th>
              <th>{compact ? "" : "ACTIONS"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link className="document-number" href={`/${k}s/${d.id}`}>
                    <span className={"file-badge " + k}>
                      <FileText size={17} />
                    </span>
                    {d.number}
                  </Link>
                </td>
                <td>
                  {d.customer_snapshot.name}
                  <small>
                    {d.customer_snapshot.ntn
                      ? `NTN ${d.customer_snapshot.ntn}`
                      : ""}
                  </small>
                </td>
                <td className="muted">{d.date}</td>
                {k === "invoice" && (
                  <td className="numeric">
                    {money(d.grand_total)} <small className="inline">PKR</small>
                  </td>
                )}
                <td>
                  <span className={"status " + d.status}>{d.status}</span>
                </td>
                <td>
                  {compact ? (
                    <Link
                      aria-label={"View " + d.number}
                      href={`/${k}s/${d.id}`}
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  ) : (
                    <DocumentActions doc={d} kind={k} reload={reload} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="empty">
            <FolderOpen size={30} />
            <h3>
              {query || range !== "all"
                ? "No matching documents"
                : "A fresh start for your paperwork"}
            </h3>
            <p>
              {query || range !== "all"
                ? "Try a different search or date range."
                : `Your ${k}s will appear here once you create one.`}
            </p>
            <Link className="text-link" href={`/${k}s/new`}>
              Create {k} <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </div>
    );
  }
  return (
    <Shell active={page} email={data?.email}>
      {error ? (
        <div className="panel error" role="alert">
          <h2>Workspace needs attention</h2>
          <p>{error}</p>
          <p>
            If this is the first run, apply the SQL migration in Supabase and
            create an Auth user.
          </p>
          <button onClick={reload}>Try again</button>
        </div>
      ) : !data ? (
        <div className="loading">Loading your workspace…</div>
      ) : (
        <>
          {page === "Dashboard" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR BUSINESS AT A GLANCE</span>
                  <h1>
                    Overview<span className="green-dot">.</span>
                  </h1>
                  <p>A little less admin. A little more room to grow.</p>
                </div>
                <Link className="primary" href="/invoices/new">
                  <Plus size={17} /> Create invoice
                </Link>
              </div>
              <div className="stats">
                {[
                  [
                    FileText,
                    "Total invoices",
                    invoices.length,
                    "All your invoices, one place",
                    "mint",
                  ],
                  [
                    Files,
                    "Total quotations",
                    quotations.length,
                    "Good business starts here",
                    "lavender",
                  ],
                  [
                    Users,
                    "Customers",
                    data.customers.filter((c) => !c.archived).length,
                    "The people you work with",
                    "peach",
                  ],
                ].map(([Icon, label, value, caption, color]) => {
                  const I = Icon as typeof FileText;
                  return (
                    <div className="stat" key={String(label)}>
                      <div className="stat-top">
                        <span>{String(label)}</span>
                        <span className={"stat-icon " + color}>
                          <I size={20} />
                        </span>
                      </div>
                      <strong>{String(value).padStart(2, "0")}</strong>
                      <small>{String(caption)}</small>
                    </div>
                  );
                })}
              </div>
              <div className="quick-panel">
                <div className="quick-art">
                  <Files size={34} />
                </div>
                <div>
                  <h3>From a conversation to a quotation.</h3>
                  <p>
                    Put your next opportunity on paper. Make it official when
                    you’re ready.
                  </p>
                </div>
                <Link href="/quotations/new">
                  New quotation <ArrowUpRight size={17} />
                </Link>
              </div>
              {!data.settings && (
                <div className="notice">
                  Before your first document,{" "}
                  <Link href="/settings">
                    review and save company settings →
                  </Link>
                </div>
              )}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recent invoices</h2>
                    <p>Your latest work, neatly filed.</p>
                  </div>
                  <Link className="text-link" href="/invoices">
                    View all invoices <ArrowRight size={15} />
                  </Link>
                </div>
                {table(invoices.slice(0, 5), "invoice", true)}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recent quotations</h2>
                    <p>Keep your next opportunities in view.</p>
                  </div>
                  <Link className="text-link" href="/quotations">
                    View all quotations <ArrowRight size={15} />
                  </Link>
                </div>
                {table(quotations.slice(0, 5), "quotation", true)}
              </section>
            </>
          ) : page === "Settings" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">MAKE IT YOURS</span>
                  <h1>Company settings</h1>
                  <p>Enter once. Use across all your future documents.</p>
                </div>
              </div>
              <RecordForm
                entity="settings"
                initial={data.settings}
                onSaved={reload}
              />
            </>
          ) : page === "Customers" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR BUSINESS CONNECTIONS</span>
                  <h1>Customers</h1>
                  <p>A familiar face behind every document.</p>
                </div>
                <button className="primary" onClick={() => setCustomer(null)}>
                  <Plus size={17} /> Add customer
                </button>
              </div>
              {customer !== undefined ? (
                <RecordForm
                  entity="customer"
                  initial={customer}
                  onSaved={() => {
                    setCustomer(undefined);
                    reload();
                  }}
                  onCancel={() => setCustomer(undefined)}
                />
              ) : (
                <>
                  <div className="search">
                    <Search size={18} />
                    <input
                      aria-label="Search customers"
                      placeholder="Search name, NTN, phone or email…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  {customerView && (
                    <div className="panel padded">
                      <button
                        className="right"
                        onClick={() => setCustomerView(undefined)}
                      >
                        Close
                      </button>
                      <h2>{customerView.name}</h2>
                      {["address", "ntn", "strn", "phone", "email"].map(
                        (key) => (
                          <p key={key}>
                            <strong>{key.toUpperCase()}: </strong>
                            {customerView[key as keyof Customer]}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                  <div className="panel table-scroll">
                    <table className="records">
                      <thead>
                        <tr>
                          <th>NAME</th>
                          <th>NTN / STRN</th>
                          <th>CONTACT</th>
                          <th>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.customers
                          .filter((c) =>
                            [c.name, c.ntn, c.phone, c.email]
                              .join(" ")
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                          )
                          .map((c) => (
                            <tr key={c.id}>
                              <td>
                                <strong>{c.name}</strong>
                                <small>{c.address}</small>
                              </td>
                              <td>
                                {c.ntn}
                                <small>{c.strn}</small>
                              </td>
                              <td>
                                {c.phone}
                                <small>{c.email}</small>
                              </td>
                              <td className="actions">
                                <button onClick={() => setCustomerView(c)}>
                                  View
                                </button>
                                <button onClick={() => setCustomer(c)}>
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {data.customers.length === 0 && (
                      <div className="empty">
                        <Users />
                        <h3>Your first customer starts here</h3>
                        <p>
                          Add their details once and reuse them on every
                          document.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : kind && id ? (
            id === "new" || edit ? (
              <DocumentForm
                kind={kind}
                doc={doc?.id === id ? doc : undefined}
                data={data}
                reload={reload}
              />
            ) : doc && doc.id === id ? (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">{kind.toUpperCase()}</span>
                    <h1>{doc.number}</h1>
                    <p>
                      {doc.customer_snapshot.name} · {doc.date}
                    </p>
                  </div>
                </div>
                <DocumentActions doc={doc} kind={kind} reload={reload} />
                <iframe
                  className="document-preview"
                  title={doc.number}
                  src={`/api/export/${kind}/${id}?format=preview`}
                />
              </>
            ) : (
              <div>Loading document…</div>
            )
          ) : kind ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">EVERY DETAIL, ON RECORD</span>
                  <h1>{page}</h1>
                  <p>
                    {kind === "invoice"
                      ? "Your invoices, from first draft to final copy."
                      : "Make the next opportunity a little more concrete."}
                  </p>
                </div>
                <Link className="primary" href={`/${kind}s/new`}>
                  <Plus size={17} /> New {kind}
                </Link>
              </div>
              <div className="filters">
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label="Search documents"
                    placeholder="Search number, customer, NTN or date…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Date filter"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                >
                  <option value="all">All dates</option>
                  <option value="today">Today</option>
                  <option value="month">This month</option>
                  <option value="year">This year</option>
                  <option value="custom">Custom range</option>
                </select>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={archived}
                    onChange={(e) => setArchived(e.target.checked)}
                  />{" "}
                  Archived
                </label>
                {range === "custom" && (
                  <>
                    <input
                      aria-label="From date"
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                    <input
                      aria-label="To date"
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </>
                )}
              </div>
              <section className="panel">
                {table(
                  (kind === "invoice" ? data.invoices : data.quotations).filter(
                    matches,
                  ),
                  kind,
                )}
              </section>
            </>
          ) : null}
        </>
      )}
    </Shell>
  );
}
