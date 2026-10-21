# Orders and accounting workflow

This extension keeps the original invoices, quotations and template exports. Accounting is accrual based, in PKR, and scoped to the signed-in owner. Separate logins have separate books; this version does not share one company across multiple staff logins.

## Install the update

In Supabase SQL Editor, run `supabase/migrations/202609160001_orders_accounting.sql` once **after** the original migration. Existing installations must not rerun the original migration. The new migration is transactional and does not delete existing records. Then restart the app and open **Accounting → Initialize accounting**. Initialization is safe to repeat and creates 14 default accounts.

Review company settings, account classifications and opening balances before posting. Existing invoices stay unposted until explicitly posted. If receivables were already included in opening balances, posting those historical invoices again would double count them.

## Daily sales workflow

1. Create a customer. Create a quotation if needed, then choose **Create Sales Order**, or create an order directly under Sales Orders.
2. Save/edit the draft order, then confirm it. Confirmation freezes the order and does not affect the ledger.
3. Convert the confirmed order to an invoice draft. Conversion is full and happens once; repeated conversion returns the same invoice. Review invoice date, taxes and items.
4. Save the invoice with status **Issued**, then choose **Post to accounts** when the sale should be recognized. Issuing alone does not post accounting.
5. Open Customer Receipts, select customer, invoice, cash/bank and amount. Partial or full receipt updates the ledger immediately.

Posting debits Accounts receivable for the invoice total, credits Sales revenue for the subtotal, and credits separate sales-tax and advance-tax clearing accounts. A receipt debits cash/bank and credits the customer's receivable.

## Daily purchase workflow

1. Create a supplier, then a purchase order with quantities and rates.
2. Confirm and convert it to a supplier bill draft. Review supplier reference, date, debit account and any recoverable purchase tax.
3. Post the bill. For goods whose cost will be recognized later, the default account is **Purchases awaiting cost allocation**. For an immediate expense, select an appropriate expense account.
4. Open Supplier Payments, select supplier, bill, cash/bank and amount, then post the payment.

A bill debits the selected asset/expense account and recoverable tax account, and credits Accounts payable. A payment debits the supplier's payable and credits cash/bank. Include non-recoverable tax in item cost rather than the recoverable tax field.

## Accounts and journals

Chart of Accounts supports assets, liabilities, equity, income and expenses. Custom cash/bank accounts must be assets. System account classifications are protected; used accounts cannot be reclassified. Inactive accounts remain visible in historical reports but cannot receive new postings.

Opening Balances accepts balance-sheet accounts only. Enter both sides of each entry, for example debit Cash 10,000 and credit Owner capital 10,000. Tag each opening receivable/payable line to its customer/supplier so party ledgers agree with control accounts.

Journal Entries supports balanced drafts, editing with stale-version checks and explicit posting. For manual cost recognition, debit Cost of goods sold and credit Purchases awaiting cost allocation. The app does not calculate stock quantities, valuation or cost of goods sold automatically.

Receipts/payments may be allocated to a posted document or applied on account against an existing party balance, including opening balances. They reject overpayment and payments predating the obligation. On-account payments do not allocate themselves to individual invoices/bills; document outstanding amounts reflect explicit allocations. Advance receipts/payments and subsequent allocation are not a dedicated workflow in this version.

## Reports

Only posted journal entries feed reports. Drafts, quotations and unconverted orders have no accounting effect.

| Report        | Meaning                                                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ledger        | Opening balance and dated movements for one account, optionally one customer/supplier. Running balance is debit minus credit, so normal liability/credit balances appear negative. |
| Trial Balance | Opening balances, period debits/credits and closing debit/credit totals.                                                                                                           |
| Profit & Loss | Revenue minus posted cost of sales and other expenses for the selected period.                                                                                                     |
| Balance Sheet | Assets, liabilities and equity as of a date, including accumulated unclosed profit/loss.                                                                                           |

Reports can be downloaded as CSV or printed/saved as PDF through the browser. Values are calculated with exact PostgreSQL numerics and returned as strings. Screens display two decimals; CSV preserves underlying precision. Order/bill/journal details also have a print action. Original invoices and quotations retain their template-based PDF/Excel exports.

## Corrections and period close

Posted entries cannot be edited. In Journal Entries, select **Reverse**, provide a reason and an open-period date, then post the reversing entry. Original and reversal both remain in history, and reports apply each on its own date. Reverse linked receipts/payments before reversing their invoice/bill. Reversals cannot themselves be reversed in this version.

For a corrected invoice, reverse its journal, duplicate the original invoice, correct and post the new draft. For a corrected bill, reverse and create a new bill. Posted source documents remain frozen even after reversal. Archiving an invoice only hides it from normal lists; it does not cancel revenue or receivables.

The Journal Entries page can lock posting through a selected date. Locks also block backdated postings and cannot be reopened through the app. Use a later open date for corrections.

## Current boundaries

- Full order conversion only; no partial deliveries, goods receipts, stock module or automatic costing.
- One currency, PKR. No exchange gains/losses or bank reconciliation module.
- Internal bookkeeping reports, not a complete statutory financial statement or tax-return package. No automated year-end closing or tax filing.
- Tax rates retain the original editable invoice behavior. Tax clearing classifications are defaults; reconcile and reclassify them according to the business's actual treatment.
- No automatic posting of legacy invoices, bank imports or bulk migration of opening balances.
- Security uses owner-scoped RLS and transactional RPCs. Financial writes are serialized per owner, posting/conversion is idempotent, and draft edits require the version last read.

Financial-statement terminology reference: [IFRS IAS 1 overview](https://www.ifrs.org/issued-standards/list-of-standards/ias-1-presentation-of-financial-statements/). This application does not claim IFRS compliance. Database implementation references: [Supabase database functions](https://supabase.com/docs/guides/database/functions) and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
