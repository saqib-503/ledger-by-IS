"use client";
import { useState } from "react";
import { accountingCommand } from "@/lib/accounting/client";
import type { Account } from "@/lib/accounting/types";
import type { Customer } from "@/lib/types";
export function MasterForm({
  kind,
  initial,
  onDone,
  onCancel,
}: {
  kind: "account" | "supplier";
  initial?: Account | Customer;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isAccount = kind === "account";
  const initialValues = isAccount
    ? { code: "", name: "", category: "expense", is_cash: false, active: true }
    : {
        name: "",
        address: "",
        ntn: "",
        strn: "",
        phone: "",
        email: "",
        archived: false,
      };
  const [values, setValues] = useState<Record<string, string | boolean>>({
    ...initialValues,
    ...initial,
  } as unknown as Record<string, string | boolean>);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function field(key: string) {
    return (
      <label key={key}>
        {key.replaceAll("_", " ")}
        <input
          required={["name", "code"].includes(key)}
          type={key === "email" ? "email" : "text"}
          value={String(values[key] ?? "")}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        />
      </label>
    );
  }
  return (
    <form
      className="panel padded"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await accountingCommand(
            isAccount ? "save_account" : "save_supplier",
            { ...values, id: initial?.id },
          );
          onDone();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>
        {initial ? "Edit" : "New"} {kind}
      </h2>
      <div className="form-grid">
        {(isAccount
          ? ["code", "name"]
          : ["name", "address", "ntn", "strn", "phone", "email"]
        ).map(field)}
        {isAccount ? (
          <>
            <label>
              Category
              <select
                aria-label="Category"
                value={String(values.category)}
                onChange={(e) =>
                  setValues({ ...values, category: e.target.value })
                }
              >
                {["asset", "liability", "equity", "income", "expense"].map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={Boolean(values.is_cash)}
                onChange={(e) =>
                  setValues({ ...values, is_cash: e.target.checked })
                }
              />{" "}
              Cash or bank account
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={Boolean(values.active)}
                onChange={(e) =>
                  setValues({ ...values, active: e.target.checked })
                }
              />{" "}
              Active account
            </label>
          </>
        ) : (
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(values.archived)}
              onChange={(e) =>
                setValues({ ...values, archived: e.target.checked })
              }
            />{" "}
            Archive supplier
          </label>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button disabled={busy} className="primary">
          {busy ? "Saving…" : `Save ${kind}`}
        </button>
      </div>
    </form>
  );
}
