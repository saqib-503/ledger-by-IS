import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Ledger | Invoices & Quotations",
  description: "Invoice and quotation management",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
