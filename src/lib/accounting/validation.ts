import { z } from "zod";
import { customerSchema, itemSchema } from "../validation";
const text = z.string().trim().max(4000),
  id = z.uuid(),
  date = z.iso.date(),
  optionalId = z
    .union([id, z.literal("")])
    .nullable()
    .optional();
const amount = z
  .string()
  .regex(/^\d{1,29}(\.\d{1,20})?$/, "Use a non-negative decimal amount");
const trade = z.object({
  id: optionalId,
  version: z.string().optional(),
  party_id: id,
  date,
  due_date: z.union([date, z.literal("")]).optional(),
  notes: text,
  items: z.array(itemSchema).min(1),
});
const journalLine = z.object({
  account_id: id,
  customer_id: optionalId,
  supplier_id: optionalId,
  description: text.optional(),
  debit: amount,
  credit: amount,
});
const schemas = {
  initialize: z.object({}),
  save_account: z.object({
    id: optionalId,
    code: z.string().regex(/^[A-Za-z0-9-]{1,20}$/),
    name: text.min(1),
    category: z.enum(["asset", "liability", "equity", "income", "expense"]),
    is_cash: z.boolean(),
    active: z.boolean(),
  }),
  save_supplier: customerSchema.extend({ id: optionalId }),
  save_order: trade.extend({
    kind: z.enum(["sales", "purchase"]),
    quotation_id: optionalId,
  }),
  save_bill: trade.extend({
    debit_account_id: id,
    tax_amount: amount,
    reference: text,
  }),
  quotation_order: z.object({ id }),
  order_status: z.object({ id, status: z.enum(["confirmed", "cancelled"]) }),
  convert_order: z.object({ id }),
  post_invoice: z.object({ id }),
  post_bill: z.object({ id }),
  save_journal: z.object({
    id: optionalId,
    version: z.string().optional(),
    date,
    memo: text.min(1),
    source_type: z.enum(["manual", "opening"]),
    post: z.boolean(),
    lines: z.array(journalLine).min(2),
  }),
  post_journal: z.object({ id }),
  settle: z.object({
    kind: z.enum(["receipt", "payment"]),
    party_id: id,
    cash_account_id: id,
    target_id: optionalId,
    date,
    amount,
    reference: text,
    notes: text,
  }),
  reverse: z.object({ id, date, reason: text.min(1) }),
  lock_period: z.object({ date }),
};
export function validateCommand(action: string, data: unknown) {
  if (!Object.hasOwn(schemas, action)) throw new Error("Unknown action");
  return schemas[action as keyof typeof schemas].parse(data);
}
