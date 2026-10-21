"use client";
import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { money } from "@/lib/calculations";
import { today } from "@/lib/accounting/client";
import type {
  AccountingData,
  AccountingReport,
  Section,
  ReportAccount,
} from "@/lib/accounting/types";
export function Reports({
  section,
  data,
}: {
  section: Section;
  data: AccountingData;
}) {
  const now = today();
  const [from, setFrom] = useState(now.slice(0, 4) + "-01-01"),
    [to, setTo] = useState(now),
    [account, setAccount] = useState(data.accounts[0]?.id || ""),
    [party, setParty] = useState(""),
    [report, setReport] = useState<AccountingReport>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const selected = data.accounts.find((a) => a.id === account);
  const partyKind =
    selected?.system_key === "receivable"
      ? "customer"
      : selected?.system_key === "payable"
        ? "supplier"
        : "";
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    const p = new URLSearchParams({ report: "1", from, to });
    if (section === "ledger") {
      p.set("account", account);
      if (party && partyKind) {
        p.set("party", party);
        p.set("partyKind", partyKind);
      }
    }
    fetch("/api/accounting?" + p, { signal: abort.signal })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        setReport(result);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setReport(undefined);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [from, to, account, party, partyKind, section]);
  const natural = (a: ReportAccount) =>
    new Decimal(a.closing)
      .times(["asset", "expense"].includes(a.category) ? 1 : -1)
      .toFixed();
  function download() {
    if (!report) return;
    let rows: (string | number)[][] = [
      ["Report", section],
      ["From", from],
      ["As of", to],
    ];
    if (section === "ledger")
      rows.push(
        ["Opening debit - credit", report.opening],
        [
          "Date",
          "Journal",
          "Account",
          "Memo",
          "Debit",
          "Credit",
          "Running debit - credit",
        ],
        ...report.ledger.map((l) => [
          l.date,
          l.number,
          l.account_name || "",
          l.memo,
          l.debit,
          l.credit,
          l.running,
        ]),
      );
    else if (section === "profit-loss")
      rows.push(
        ["Income", report.income],
        ["Cost of sales", report.cost_of_sales],
        ["Gross profit", report.gross_profit],
        ["Operating expenses", report.operating_expenses],
        ["Net profit", report.net_profit],
        ["Code", "Account", "Period amount"],
        ...report.accounts
          .filter((a) => ["income", "expense"].includes(a.category))
          .map((a) => [
            a.code,
            a.name,
            new Decimal(a.category === "income" ? a.credit : a.debit)
              .minus(a.category === "income" ? a.debit : a.credit)
              .toFixed(),
          ]),
      );
    else
      rows.push(
        [
          "Code",
          "Account",
          "Category",
          "Opening debit - credit",
          "Period debit",
          "Period credit",
          "Closing debit - credit",
        ],
        ...report.accounts.map((a) => [
          a.code,
          a.name,
          a.category,
          a.opening,
          a.debit,
          a.credit,
          a.closing,
        ]),
        ["Assets", report.assets],
        ["Liabilities", report.liabilities],
        ["Equity including accumulated profit", report.total_equity],
        ["Balance difference", report.balance_difference],
      );
    const csv = rows
      .map((row) =>
        row
          .map((v) => {
            let s = String(v);
            if (/^[=+@-]/.test(s.trimStart()) || /^[\t\r\n]/.test(s))
              s = "'" + s;
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${section}-${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function group(title: string, category: string) {
    if (!report) return null;
    const entries = report.accounts.filter(
      (a) => a.category === category && !new Decimal(a.closing).isZero(),
    );
    return (
      <section className="panel padded">
        <h2>{title}</h2>
        {entries.map((a) => (
          <div className="report-line" key={a.id}>
            <span>
              {a.code} · {a.name}
            </span>
            <strong>{money(natural(a))}</strong>
          </div>
        ))}
        {!entries.length && <p className="muted">No balances.</p>}
      </section>
    );
  }
  return (
    <>
      <div className="filters no-print">
        {section !== "balance-sheet" && (
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
        )}
        <label>
          {section === "balance-sheet" ? "As of" : "To"}
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              if (section === "balance-sheet") setFrom(e.target.value);
            }}
          />
        </label>
        {section === "ledger" && (
          <>
            <label>
              Account
              <select
                aria-label="Ledger account"
                value={account}
                onChange={(e) => {
                  setAccount(e.target.value);
                  setParty("");
                }}
              >
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            {partyKind && (
              <label>
                {partyKind}
                <select
                  aria-label="Ledger party"
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                >
                  <option value="">All {partyKind}s</option>
                  {(partyKind === "customer"
                    ? data.customers
                    : data.suppliers
                  ).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        <button disabled={!report || loading} onClick={download}>
          Download CSV
        </button>
        <button disabled={!report || loading} onClick={() => window.print()}>
          Print report
        </button>
      </div>
      <p className="report-caption">
        {section === "balance-sheet" ? `As of ${to}` : `${from} to ${to}`} · PKR
        · Posted entries only
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="loading">Calculating report…</div>
      ) : (
        report && (
          <>
            {section === "ledger" ? (
              <section className="panel padded">
                <h2>
                  {selected?.name}
                  {party
                    ? " · " +
                      (partyKind === "customer"
                        ? data.customers
                        : data.suppliers
                      ).find((p) => p.id === party)?.name
                    : ""}
                </h2>
                <p>
                  Opening balance: <strong>{money(report.opening)}</strong>{" "}
                  <small>(debit − credit)</small>
                </p>
                <div className="table-scroll">
                  <table className="records">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Journal</th>
                        <th>Memo</th>
                        <th>Debit</th>
                        <th>Credit</th>
                        <th>Running balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.ledger.map((l) => (
                        <tr key={l.id}>
                          <td>{l.date}</td>
                          <td>{l.number}</td>
                          <td>
                            {l.memo}
                            <small>{l.description}</small>
                          </td>
                          <td className="numeric">{money(l.debit)}</td>
                          <td className="numeric">{money(l.credit)}</td>
                          <td className="numeric">{money(l.running)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!report.ledger.length && (
                    <p className="empty">No posted movements in this period.</p>
                  )}
                </div>
              </section>
            ) : section === "trial-balance" ? (
              <section className="panel">
                <div className="table-scroll">
                  <table className="records">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Account</th>
                        <th>Opening Dr − Cr</th>
                        <th>Period debit</th>
                        <th>Period credit</th>
                        <th>Closing debit</th>
                        <th>Closing credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.accounts.map((a) => (
                        <tr key={a.id}>
                          <td>{a.code}</td>
                          <td>{a.name}</td>
                          <td className="numeric">{money(a.opening)}</td>
                          <td className="numeric">{money(a.debit)}</td>
                          <td className="numeric">{money(a.credit)}</td>
                          <td className="numeric">
                            {money(Decimal.max(a.closing, 0).toFixed())}
                          </td>
                          <td className="numeric">
                            {money(
                              Decimal.max(
                                new Decimal(a.closing).negated(),
                                0,
                              ).toFixed(),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5}>Closing totals</td>
                        <td className="numeric">
                          {money(report.trial_debits)}
                        </td>
                        <td className="numeric">
                          {money(report.trial_credits)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p
                  className={
                    new Decimal(report.trial_debits).eq(report.trial_credits)
                      ? "success"
                      : "error"
                  }
                >
                  {new Decimal(report.trial_debits).eq(report.trial_credits)
                    ? "Trial balance agrees."
                    : "Trial balance does not agree."}
                </p>
              </section>
            ) : section === "profit-loss" ? (
              <>
                <div className="stats">
                  {[
                    ["Revenue", report.income],
                    ["Gross profit", report.gross_profit],
                    ["Net profit / loss", report.net_profit],
                  ].map(([label, value]) => (
                    <div className="stat" key={label}>
                      <span>{label}</span>
                      <strong className="report-stat">{money(value)}</strong>
                      <small>PKR</small>
                    </div>
                  ))}
                </div>
                <section className="panel padded">
                  <h2>Profit & Loss</h2>
                  {[
                    ["Revenue", report.income],
                    ["Cost of goods sold", report.cost_of_sales],
                    ["Gross profit", report.gross_profit],
                    ["Operating expenses", report.operating_expenses],
                    ["Net profit / loss", report.net_profit],
                  ].map(([label, value]) => (
                    <div className="report-line" key={label}>
                      <span>{label}</span>
                      <strong>{money(value)}</strong>
                    </div>
                  ))}
                  <p className="notice">
                    No inventory costing is automated. This report includes only
                    costs and expenses you have posted.
                  </p>
                </section>
                <section className="panel padded">
                  <h2>Income and expense accounts</h2>
                  {report.accounts
                    .filter((a) => ["income", "expense"].includes(a.category))
                    .map((a) => (
                      <div className="report-line" key={a.id}>
                        <span>
                          {a.code} · {a.name}
                        </span>
                        <strong>
                          {money(
                            new Decimal(
                              a.category === "income" ? a.credit : a.debit,
                            )
                              .minus(
                                a.category === "income" ? a.debit : a.credit,
                              )
                              .toFixed(),
                          )}
                        </strong>
                      </div>
                    ))}
                </section>
              </>
            ) : (
              <>
                <div className="stats">
                  {[
                    ["Assets", report.assets],
                    ["Liabilities", report.liabilities],
                    ["Equity", report.total_equity],
                  ].map(([label, value]) => (
                    <div className="stat" key={label}>
                      <span>{label}</span>
                      <strong className="report-stat">{money(value)}</strong>
                      <small>PKR</small>
                    </div>
                  ))}
                </div>
                {group("Assets", "asset")}
                {group("Liabilities", "liability")}
                {group("Equity accounts", "equity")}
                <section className="panel padded">
                  <div className="report-line">
                    <span>Accumulated unclosed profit / loss</span>
                    <strong>{money(report.accumulated_profit)}</strong>
                  </div>
                  <div className="report-line">
                    <span>Total equity</span>
                    <strong>{money(report.total_equity)}</strong>
                  </div>
                  <div className="report-line">
                    <span>Assets − liabilities − equity</span>
                    <strong>{money(report.balance_difference)}</strong>
                  </div>
                  <p
                    className={
                      new Decimal(report.balance_difference).isZero()
                        ? "success"
                        : "error"
                    }
                  >
                    {new Decimal(report.balance_difference).isZero()
                      ? "Balance sheet balances."
                      : "Balance sheet difference requires review."}
                  </p>
                </section>
              </>
            )}
          </>
        )
      )}
    </>
  );
}
