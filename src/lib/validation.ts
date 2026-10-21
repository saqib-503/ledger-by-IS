import { z } from "zod";
const text = z.string().trim().max(4000);
const decimal = z
  .union([z.string(), z.number()])
  .transform(String)
  .refine(
    (v) => /^\d{1,10}(\.\d{1,4})?$/.test(v) && Number(v) <= 1e9,
    "Use a positive number with up to four decimal places",
  );
export const customerSchema = z.object({
  name: text.min(1),
  address: text,
  ntn: text,
  strn: text,
  phone: text,
  email: z.union([z.literal(""), z.email()]),
  archived: z.boolean().optional(),
});
export const itemSchema = z.object({
  description: text.min(1),
  hs_code: text,
  quantity: decimal.refine((v) => Number(v) > 0),
  rate: decimal,
});
export const documentSchema = z.object({
  customer_id: z.uuid(),
  date: z.iso.date(),
  status: z.enum(["draft", "issued"]),
  notes: text,
  declaration: text,
  items: z.array(itemSchema).min(1),
  sales_tax_rate: decimal.refine((v) => Number(v) <= 100),
  advance_tax_rate: decimal.refine((v) => Number(v) <= 100),
});
export const settingsSchema = z.object({
  company_name: text.min(1),
  address: text,
  quotation_address: text,
  phone: text,
  secondary_phone: text,
  email: z.union([z.literal(""), z.email()]),
  ntn: text,
  strn: text,
  bank_name: text,
  bank_branch: text,
  account_title: text,
  account_number: text,
  iban: text,
  logo_url: z.union([
    z.literal(""),
    z.url().refine((v) => v.startsWith("https://")),
  ]),
  declaration: text,
  invoice_prefix: z.string().regex(/^[A-Za-z0-9-]{1,16}$/),
  quotation_prefix: z.string().regex(/^[A-Za-z0-9-]{1,16}$/),
  sales_tax_rate: decimal.refine((v) => Number(v) <= 100),
  advance_tax_rate: decimal.refine((v) => Number(v) <= 100),
});
