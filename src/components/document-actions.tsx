"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { accountingCommand } from "@/lib/accounting/client";
import { api } from "@/lib/client";
import type { Kind, Document } from "@/lib/types";
export function DocumentActions({
  doc,
  kind,
  reload,
}: {
  doc: Document;
  kind: Kind;
  reload?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act(action: string) {
    if (
      action === "archive" &&
      !confirm(
        doc.archived
          ? "Restore this document?"
          : "Archive this document? It can be restored later.",
      )
    )
      return;
    setBusy(true);
    try {
      const result = await api({
        kind,
        id: doc.id,
        action,
        archived: !doc.archived,
      });
      if (action === "archive") reload?.();
      else router.push("/" + result.kind + "s/" + result.id + "/edit");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function accounting(action: "post_invoice" | "quotation_order") {
    if (
      action === "post_invoice" &&
      !confirm(
        "Post this invoice to accounting? Posted invoices cannot be edited; corrections require a reversal.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await accountingCommand(action, { id: doc.id });
      if (action === "quotation_order")
        router.push(`/accounting/sales-orders?edit=${result.id}`);
      else {
        reload?.();
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(format: "pdf" | "xlsx") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/export/${kind}/${doc.id}?format=${format}`,
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${doc.number}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="actions">
        <Link href={`/${kind}s/${doc.id}`}>View</Link>
        {!doc.accounting_journal_id && (
          <Link href={`/${kind}s/${doc.id}/edit`}>Edit</Link>
        )}
        <a
          onClick={(e) => {
            e.preventDefault();
            if (!busy) void download("pdf");
          }}
          download={`${doc.number}.pdf`}
          href={`/api/export/${kind}/${doc.id}?format=pdf`}
        >
          PDF
        </a>
        <a
          onClick={(e) => {
            e.preventDefault();
            if (!busy) void download("xlsx");
          }}
          download={`${doc.number}.xlsx`}
          href={`/api/export/${kind}/${doc.id}?format=xlsx`}
        >
          Excel
        </a>
        <a target="_blank" href={`/api/export/${kind}/${doc.id}?format=print`}>
          Print
        </a>
        {kind === "invoice" &&
          (doc.accounting_journal_id ? (
            <Link
              href={`/accounting/journals?view=${doc.accounting_journal_id}`}
            >
              View journal
            </Link>
          ) : doc.status === "issued" && !doc.archived ? (
            <button disabled={busy} onClick={() => accounting("post_invoice")}>
              Post to accounts
            </button>
          ) : null)}
        {kind === "quotation" && (
          <button disabled={busy} onClick={() => accounting("quotation_order")}>
            Create Sales Order
          </button>
        )}
        <button disabled={busy} onClick={() => act("duplicate")}>
          Duplicate
        </button>
        {kind === "quotation" && (
          <button disabled={busy} onClick={() => act("convert")}>
            Convert to Invoice
          </button>
        )}
        <button disabled={busy} onClick={() => act("archive")}>
          {doc.archived ? "Restore" : "Archive"}
        </button>
      </div>
      {error && (
        <small role="alert" className="error">
          {error}
        </small>
      )}
    </div>
  );
}
