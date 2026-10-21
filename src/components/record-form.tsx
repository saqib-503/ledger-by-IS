"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import defaults from "../../templates/defaults.json";
const customerFields = ["name", "address", "ntn", "strn", "phone", "email"];
export function RecordForm({
  entity,
  initial,
  onSaved,
  onCancel,
}: {
  entity: "customer" | "settings";
  initial: unknown;
  onSaved: (result?: any) => void;
  onCancel?: () => void;
}) {
  const init = initial as Record<string, string> | null;
  const fields = entity === "customer" ? customerFields : Object.keys(defaults);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((k) => [
        k,
        String(
          init?.[k] ??
            (entity === "settings"
              ? (defaults as Record<string, string>)[k]
              : ""),
        ),
      ]),
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  return (
    <form
      className="panel padded"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const result = await api({ entity, id: init?.id, data: values });
          setSaved(true);
          onSaved(result);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>
        {entity === "customer"
          ? init
            ? "Edit customer"
            : "New customer"
          : "Company profile"}
      </h2>
      {entity === "settings" && (
        <p className="notice">
          The original quotation declaration contains “60%” for both advance and
          remaining balance. Review this wording before issuing quotations.
        </p>
      )}
      <div className="form-grid">
        {fields.map((key) => (
          <label
            key={key}
            className={
              ["address", "quotation_address", "declaration"].includes(key)
                ? "wide"
                : ""
            }
          >
            {key.replaceAll("_", " ")}
            {["address", "quotation_address", "declaration"].includes(key) ? (
              <textarea
                rows={3}
                value={values[key]}
                onChange={(e) =>
                  setValues({ ...values, [key]: e.target.value })
                }
              />
            ) : (
              <input
                value={values[key]}
                type={
                  key === "email"
                    ? "email"
                    : key === "logo_url"
                      ? "url"
                      : "text"
                }
                required={["name", "company_name"].includes(key)}
                onChange={(e) =>
                  setValues({ ...values, [key]: e.target.value })
                }
              />
            )}
          </label>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="success" role="status">
          Saved successfully.
        </p>
      )}
      <div className="form-actions">
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button disabled={busy} className="primary">
          {busy
            ? "Saving…"
            : "Save " + (entity === "settings" ? "settings" : "customer")}
        </button>
      </div>
    </form>
  );
}
