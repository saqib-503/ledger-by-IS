import type { Customer, Item, Document } from "../types";
export interface Account {
  id: string;
  code: string;
  name: string;
  category: "asset" | "liability" | "equity" | "income" | "expense";
  system_key: string | null;
  is_cash: boolean;
  active: boolean;
}
export interface Journal {
  id: string;
  number: string;
  date: string;
  memo: string;
  source_type: string;
  source_id: string | null;
  status: "draft" | "posted";
  reverses_id: string | null;
  created_at: string;
  updated_at: string;
  items?: JournalLine[];
}
export interface JournalLine {
  account_id: string;
  customer_id?: string | null;
  supplier_id?: string | null;
  description?: string;
  debit: string;
  credit: string;
  account_code?: string;
  account_name?: string;
}
export interface TradeDocument {
  id: string;
  kind?: "sales" | "purchase";
  number: string;
  date: string;
  due_date?: string | null;
  customer_id?: string;
  supplier_id?: string;
  party_snapshot?: Customer;
  supplier_snapshot?: Customer;
  notes: string;
  status?: "draft" | "confirmed" | "cancelled" | "converted";
  total: string;
  subtotal?: string;
  tax_amount?: string;
  reference?: string;
  debit_account_id?: string;
  journal_id?: string | null;
  invoice_id?: string | null;
  bill_id?: string | null;
  quotation_id?: string | null;
  updated_at: string;
  items?: Item[];
}
export interface Settlement {
  id: string;
  kind: "receipt" | "payment";
  number: string;
  date: string;
  customer_id: string | null;
  supplier_id: string | null;
  invoice_id: string | null;
  bill_id: string | null;
  cash_account_id: string;
  amount: string;
  reference: string;
  notes: string;
  journal_id: string;
}
export interface AccountingData {
  email: string;
  config: { locked_through: string | null } | null;
  accounts: Account[];
  suppliers: Customer[];
  customers: Customer[];
  orders: TradeDocument[];
  bills: TradeDocument[];
  journals: Journal[];
  settlements: Settlement[];
  invoices: Document[];
}
export interface ReportAccount extends Account {
  opening: string;
  debit: string;
  credit: string;
  closing: string;
}
export interface LedgerLine extends JournalLine {
  id: string;
  date: string;
  number: string;
  memo: string;
  journal_id: string;
  running: string;
}
export interface AccountingReport {
  accounts: ReportAccount[];
  ledger: LedgerLine[];
  opening: string;
  income: string;
  cost_of_sales: string;
  operating_expenses: string;
  gross_profit: string;
  net_profit: string;
  assets: string;
  liabilities: string;
  equity: string;
  accumulated_profit: string;
  total_equity: string;
  balance_difference: string;
  trial_debits: string;
  trial_credits: string;
}
export const sections = {
  accounts: "Chart of Accounts",
  suppliers: "Suppliers",
  "sales-orders": "Sales Orders",
  "purchase-orders": "Purchase Orders",
  bills: "Supplier Bills",
  receipts: "Customer Receipts",
  payments: "Supplier Payments",
  journals: "Journal Entries",
  "opening-balances": "Opening Balances",
  ledger: "Ledger",
  "trial-balance": "Trial Balance",
  "profit-loss": "Profit & Loss",
  "balance-sheet": "Balance Sheet",
} as const;
export type Section = keyof typeof sections;
