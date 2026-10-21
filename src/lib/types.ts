export type Kind = "invoice" | "quotation";
export interface Customer {
  id: string;
  name: string;
  address: string;
  ntn: string;
  strn: string;
  phone: string;
  email: string;
  archived?: boolean;
}
export interface Company {
  [key: string]: string;
  company_name: string;
  address: string;
  quotation_address: string;
  declaration: string;
}
export interface Item {
  description: string;
  hs_code: string;
  quantity: string;
  rate: string;
  amount?: string;
}
export interface Document {
  accounting_journal_id?: string | null;
  id: string;
  number: string;
  customer_id: string;
  date: string;
  status: "draft" | "issued";
  archived: boolean;
  notes: string;
  declaration: string;
  sales_tax_rate: string;
  advance_tax_rate: string;
  subtotal: string;
  sales_tax_amount: string;
  value_including_tax: string;
  advance_tax_amount: string;
  grand_total: string;
  customer_snapshot: Customer;
  company_snapshot: Company;
  items: Item[];
  updated_at: string;
}
